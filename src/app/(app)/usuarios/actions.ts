"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { db, friendly } from "@/lib/auth";
import { getStudioModalities } from "@/lib/modalities";
import { createAdminClient } from "@/lib/supabase/admin";

/** `saved` tells the dialog to close itself; the actions do not redirect, so the page stays where it is. */
export type FormState = { error?: string; saved?: boolean } | undefined;

const text = (v: FormDataEntryValue | null) => String(v ?? "").trim();
const orNull = (v: string) => (v === "" ? null : v);

async function requireAdmin() {
  const supabase = await db();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Sessão expirada. Entre novamente.");
  const { data: profile } = await supabase.from("profiles").select("role, studio_id").eq("id", user.id).maybeSingle();
  if (profile?.role !== "admin") throw new Error("Apenas administradores podem gerenciar usuários.");
  return { supabase, userId: user.id as string, studioId: profile.studio_id as string };
}

/** The modalities ticked on the form, checked against what the studio offers. */
async function readModalities(formData: FormData, role: "admin" | "instructor"): Promise<string[] | string> {
  const offered = new Set((await getStudioModalities()).map((m) => m.id));
  const ids = [...new Set(formData.getAll("modality").map(String))];
  if (ids.some((id) => !offered.has(id))) return "Modalidade inválida.";
  if (role === "instructor" && ids.length === 0) return "Escolha ao menos uma modalidade que o instrutor ensina.";
  return ids;
}

/** Makes the modalities a user teaches exactly `ids` (works with either the RLS-scoped or the admin client). */
async function syncModalities(client: SupabaseClient,userId: string, ids: string[]) {
  const del = client.from("user_modalities").delete().eq("user_id", userId);
  const { error: removeError } = ids.length > 0 ? await del.not("modality_id", "in", `(${ids.join(",")})`) : await del;
  if (removeError) return { error: removeError };
  if (ids.length === 0) return { error: null };
  return client.from("user_modalities").upsert(ids.map((modality_id) => ({ user_id: userId, modality_id })), { onConflict: "user_id,modality_id", ignoreDuplicates: true });
}

const inviteSchema = z.object({
  name: z.string().min(2, "Informe o nome."),
  email: z.string().email("E-mail inválido."),
  role: z.enum(["admin", "instructor"], { message: "Escolha um papel." }),
  working_hours: z.string().nullable(),
});

/** Sends a Supabase invite email and creates the profile row once admin privileges are confirmed. */
export async function inviteUser(_prev: FormState, formData: FormData): Promise<FormState> {
  const { studioId } = await requireAdmin();
  const parsed = inviteSchema.safeParse({
    name: text(formData.get("name")),
    email: text(formData.get("email")),
    role: text(formData.get("role")),
    working_hours: orNull(text(formData.get("working_hours"))),
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const modalityIds = await readModalities(formData, parsed.data.role);
  if (typeof modalityIds === "string") return { error: modalityIds };

  try {
    const h = await headers();
    const origin = h.get("origin") ?? `https://${h.get("host")}`;
    const admin = createAdminClient();
    const { data, error } = await admin.auth.admin.inviteUserByEmail(parsed.data.email, {
      data: { full_name: parsed.data.name },
      redirectTo: `${origin}/convite`,
    });
    if (error) return { error: error.message.toLowerCase().includes("already registered") ? "Já existe uma conta com este e-mail." : error.message };
    const userId = data.user.id;
    const { error: profileError } = await admin.from("profiles").insert({
      id: userId,
      email: parsed.data.email,
      name: parsed.data.name,
      role: parsed.data.role,
      working_hours: parsed.data.working_hours,
      studio_id: studioId,
    });
    if (profileError) {
      await admin.auth.admin.deleteUser(userId);
      return { error: friendly(profileError) };
    }
    {
      // A new admin already teaches every modality of the studio (migration 0012): make it exactly what was ticked.
      const { error: modalitiesError } = await syncModalities(admin, userId, modalityIds);
      if (modalitiesError) {
        await admin.auth.admin.deleteUser(userId); // the profile goes with it (cascade)
        return { error: friendly(modalitiesError) };
      }
    }
  } catch (e) {
    return { error: (e as Error).message };
  }
  revalidatePath("/usuarios");
  return { saved: true };
}

const updateSchema = z.object({
  name: z.string().min(2, "Informe o nome."),
  role: z.enum(["admin", "instructor"], { message: "Escolha um papel." }),
  working_hours: z.string().nullable(),
});

export async function updateUser(userId: string, _prev: FormState, formData: FormData): Promise<FormState> {
  const { supabase } = await requireAdmin();
  const parsed = updateSchema.safeParse({
    name: text(formData.get("name")),
    role: text(formData.get("role")),
    working_hours: orNull(text(formData.get("working_hours"))),
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const modalityIds = await readModalities(formData, parsed.data.role);
  if (typeof modalityIds === "string") return { error: modalityIds };

  const { data: current, error: currentError } = await supabase.from("user_modalities").select("modality_id").eq("user_id", userId);
  if (currentError) return { error: friendly(currentError) };
  const had = new Set((current ?? []).map((r) => r.modality_id as string));
  const want = new Set(modalityIds);
  const removed = [...had].filter((id) => !want.has(id));

  // Stopping a modality would silently leave their clients without an instructor: make the admin reassign first.
  if (removed.length > 0) {
    const { count, error: countError } = await supabase
      .from("client_modality_instructors")
      .select("client_id", { count: "exact", head: true })
      .eq("instructor_id", userId)
      .in("modality_id", removed);
    if (countError) return { error: friendly(countError) };
    if ((count ?? 0) > 0) return { error: `Esta pessoa é responsável por ${count} ${count === 1 ? "cliente" : "clientes"} nessa modalidade. Reatribua antes de removê-la.` };
  }

  const { error } = await supabase.from("profiles").update(parsed.data).eq("id", userId);
  if (error) return { error: friendly(error) };
  // Becoming an admin adds every studio modality (migration 0012); make it exactly what was ticked.
  const { error: syncError } = await syncModalities(supabase, userId, [...want]);
  if (syncError) return { error: friendly(syncError) };
  revalidatePath("/usuarios");
  return { saved: true };
}

export async function removeUser(userId: string): Promise<void> {
  const { supabase, userId: adminId } = await requireAdmin();
  if (adminId === userId) throw new Error("Você não pode remover a própria conta.");
  // The admin client below bypasses RLS entirely, so confirm studio membership through the
  // RLS-scoped client first — this only returns a row when userId is in the admin's own studio.
  const { data: target } = await supabase.from("profiles").select("id").eq("id", userId).maybeSingle();
  if (!target) throw new Error("Usuário não encontrado.");
  const admin = createAdminClient();
  const { error } = await admin.auth.admin.deleteUser(userId);
  if (error) throw new Error(error.message);
  revalidatePath("/usuarios");
  revalidatePath("/clientes", "layout");
  redirect("/usuarios");
}
