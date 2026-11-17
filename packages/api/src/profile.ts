import type { SupabaseClient } from "@supabase/supabase-js";

const TITLES = /^(dr|dra|sr|sra)\.?$/i;

export type Role = "admin" | "instructor";
export type Me = { id: string; email: string; name: string; firstName: string; initials: string; role: Role; workingHours: string | null; studioId: string | null };

export function buildMe(meta: Record<string, unknown> | undefined, email: string, id: string, role: Role, workingHours: string | null, studioId: string | null, profileName?: string | null): Me {
  // The name an admin edits on Usuários lives in `profiles.name`; auth metadata is only what was typed at signup/invite.
  const fromMeta = (meta?.full_name ?? meta?.name) as string | undefined;
  const name = profileName?.trim() || fromMeta?.trim() || email.split("@")[0];
  const parts = name.split(/\s+/).filter((p) => p && !TITLES.test(p));
  const firstName = parts[0] ?? name;
  const initials = parts.length === 0 ? "?" : (parts[0][0] + (parts.length > 1 ? parts[parts.length - 1][0] : "")).toUpperCase();
  return { id, email, name, firstName, initials, role, workingHours, studioId };
}

export type ProfileRow = { role: string | null; working_hours: string | null; studio_id: string | null; name: string | null };

export function meFromProfile(user: { id: string; email?: string; user_metadata?: Record<string, unknown> }, profile: ProfileRow): Me {
  const role: Role = profile.role === "admin" ? "admin" : "instructor";
  return buildMe(user.user_metadata, user.email ?? "", user.id, role, profile.working_hours, profile.studio_id, profile.name);
}

/**
 * The signed-in person with their role, or `null` when there is no session or no profile yet.
 * Unlike the web, this never creates a studio: a person who signed up but never opened the web app
 * has no profile, and the caller explains that instead of provisioning one from a phone.
 */
export async function getMe(supabase: SupabaseClient): Promise<Me | null> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: profile, error } = await supabase.from("profiles").select("role, working_hours, studio_id, name").eq("id", user.id).maybeSingle();
  if (error) throw new Error(`Não foi possível carregar o perfil (${error.message}).`);
  return profile ? meFromProfile(user, profile as ProfileRow) : null;
}
