import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { checkTaughtModalities, friendly, syncUserModalities, userSchema, type Result } from "@fluxo/api";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Inviting and removing people needs the service-role key (it creates and deletes auth users), so it only ever runs on
 * the server: from the Users page's server actions, and from the token-checked route handlers the mobile app calls.
 * Both pass in a Supabase client acting as the signed-in person, which is how we know they are an admin.
 */

/** The signed-in admin and their studio, or an error message. */
export async function requireAdmin(supabase: SupabaseClient): Promise<{ userId: string; studioId: string } | { error: string }> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Sessão expirada. Entre novamente." };
  const { data: profile } = await supabase.from("profiles").select("role, studio_id").eq("id", user.id).maybeSingle();
  if (profile?.role !== "admin" || !profile.studio_id) return { error: "Apenas administradores podem gerenciar usuários." };
  return { userId: user.id, studioId: profile.studio_id as string };
}

const inviteSchema = userSchema.extend({ email: z.string().email("E-mail inválido.") });
export type InviteInput = { name: string; email: string; role: string; workingHours: string | null; modalityIds: string[] };

/** Sends a Supabase invite e-mail and creates the profile row, once admin privileges are confirmed. */
export async function inviteUserServer(supabase: SupabaseClient, input: InviteInput, origin: string): Promise<Result> {
  const who = await requireAdmin(supabase);
  if ("error" in who) return who;
  const parsed = inviteSchema.safeParse({ name: input.name.trim(), email: input.email.trim(), role: input.role, working_hours: input.workingHours?.trim() ? input.workingHours.trim() : null });
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const taught = await checkTaughtModalities(supabase, input.modalityIds, parsed.data.role);
  if (typeof taught === "string") return { error: taught };

  try {
    const admin = createAdminClient();
    // An e-mail that already has a profile (in any studio) is taken. Checked first so we never touch that account.
    const taken = await admin.from("profiles").select("id").ilike("email", parsed.data.email).maybeSingle();
    if (taken.data) return { error: "Já existe uma conta com este e-mail." };

    const { data, error } = await admin.auth.admin.inviteUserByEmail(parsed.data.email, { data: { full_name: parsed.data.name }, redirectTo: `${origin}/convite` });
    if (error) return { error: /already.*(registered|exists)/i.test(error.message) ? "Já existe uma conta com este e-mail." : error.message };
    const userId = data.user.id;
    // Only an account this very call created may be rolled back. Supabase re-sends an invite to a pending one
    // without creating anything, and that person must never be deleted because a later step failed.
    const createdNow = Date.now() - Date.parse(data.user.created_at) < 15_000;
    const rollback = async () => {
      if (createdNow) await admin.auth.admin.deleteUser(userId);
    };

    const { error: profileError } = await admin.from("profiles").insert({ id: userId, email: parsed.data.email, name: parsed.data.name, role: parsed.data.role, working_hours: parsed.data.working_hours, studio_id: who.studioId });
    if (profileError) {
      await rollback();
      return { error: profileError.code === "23505" ? "Já existe uma conta com este e-mail." : friendly(profileError) };
    }
    // A new admin already teaches every modality of the studio (migration 0012): make it exactly what was ticked.
    const { error: modalitiesError } = await syncUserModalities(admin, userId, taught);
    if (modalitiesError) {
      await rollback(); // the profile goes with the user (cascade)
      return { error: friendly(modalitiesError) };
    }
    return {};
  } catch (e) {
    return { error: (e as Error).message };
  }
}

/** Deletes the account. The admin client bypasses RLS, so studio membership is confirmed through the user's own client first. */
export async function removeUserServer(supabase: SupabaseClient, userId: string): Promise<Result> {
  const who = await requireAdmin(supabase);
  if ("error" in who) return who;
  if (who.userId === userId) return { error: "Você não pode remover a própria conta." };
  const { data: target } = await supabase.from("profiles").select("id").eq("id", userId).maybeSingle();
  if (!target) return { error: "Usuário não encontrado." };
  try {
    const { error } = await createAdminClient().auth.admin.deleteUser(userId);
    return error ? { error: error.message } : {};
  } catch (e) {
    return { error: (e as Error).message };
  }
}
