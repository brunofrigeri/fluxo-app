import { cache } from "react";
import { createClient } from "@/lib/supabase/server";

const TITLES = /^(dr|dra|sr|sra)\.?$/i;

export type Role = "admin" | "instructor";
export type Admin = { id: string; email: string; name: string; firstName: string; initials: string; role: Role; workingHours: string | null; studioId: string | null };

export function buildAdmin(meta: Record<string, unknown> | undefined, email: string, id: string, role: Role, workingHours: string | null, studioId: string | null, profileName?: string | null): Admin {
  // The name an admin edits on Usuários lives in `profiles.name`; auth metadata is only what was typed at signup/invite.
  const fromMeta = (meta?.full_name ?? meta?.name) as string | undefined;
  const name = profileName?.trim() || fromMeta?.trim() || email.split("@")[0];
  const parts = name.split(/\s+/).filter((p) => p && !TITLES.test(p));
  const firstName = parts[0] ?? name;
  const initials = parts.length === 0 ? "?" : (parts[0][0] + (parts.length > 1 ? parts[parts.length - 1][0] : "")).toUpperCase();
  return { id, email, name, firstName, initials, role, workingHours, studioId };
}

/**
 * Self-signup only creates the auth user (see src/app/signup/actions.ts) — there's no
 * session yet to act on when the Supabase project requires email confirmation. So the new
 * studio + admin profile are provisioned here instead, the first time that user is seen with
 * an active session and no profile row. Invited users never hit this path: their profile is
 * created up front by the invite Server Action.
 */
async function provisionStudio(supabase: Awaited<ReturnType<typeof createClient>>, user: { id: string; email?: string; user_metadata: Record<string, unknown> }) {
  const name = ((user.user_metadata?.full_name as string | undefined) ?? "").trim() || (user.email?.split("@")[0] ?? "Admin");
  // Generate the id ourselves and skip .select() on this insert: asking Postgres to hand the
  // row back (RETURNING) would also run it through the "read own studio" SELECT policy, which
  // can't pass yet — the profile that makes a studio "yours" doesn't exist until the next line.
  const studioId = crypto.randomUUID();
  const { error: studioError } = await supabase.from("studios").insert({ id: studioId, name: `Estúdio de ${name}` });
  if (studioError) {
    throw new Error(
      `Não foi possível criar o estúdio (${studioError.message}). ` +
        "Verifique se a migração supabase/migrations/0007_multi_tenant.sql foi executada no projeto Supabase.",
    );
  }
  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .insert({ id: user.id, email: user.email ?? "", name, role: "admin", studio_id: studioId })
    .select("role, working_hours, studio_id, name")
    .single();
  if (profileError || !profile) {
    throw new Error(`Não foi possível criar o perfil de administrador (${profileError?.message ?? "erro desconhecido"}).`);
  }

  // A new studio starts with Pilates on; the admin changes what it offers in Configurações.
  const { data: all, error: modalitiesError } = await supabase.from("modalities").select("id, key");
  if (modalitiesError) throw new Error(`Não foi possível carregar as modalidades (${modalitiesError.message}).`);
  const ids = (all ?? []).filter((m) => m.key === "pilates").map((m) => m.id as string);
  const { error: enableError } = await supabase.from("studio_modalities").insert(ids.map((modality_id) => ({ studio_id: studioId, modality_id })));
  if (enableError) throw new Error(`Não foi possível ativar as modalidades (${enableError.message}).`);
  // The founder is an admin, and admins teach every modality of the studio by default (migration 0012).
  return profile;
}

/** The signed-in user, or null. Name comes from auth metadata; role/working hours/studio from `profiles`. */
export const getAdmin = cache(async (): Promise<Admin | null> => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  let { data: profile, error: profileError } = await supabase.from("profiles").select("role, working_hours, studio_id, name").eq("id", user.id).maybeSingle();
  if (profileError) {
    // Swallowing this previously made a lookup failure look identical to "no profile yet" and
    // wrongly tried to provision a second studio for someone who already has one — surface it instead.
    throw new Error(`Não foi possível carregar o perfil (${profileError.message}).`);
  }
  if (!profile) profile = await provisionStudio(supabase, user);
  const role = (profile?.role as Role | undefined) ?? "instructor";
  return buildAdmin(user.user_metadata, user.email ?? "", user.id, role, (profile?.working_hours as string | null) ?? null, (profile?.studio_id as string | null) ?? null, profile?.name as string | null | undefined);
});
