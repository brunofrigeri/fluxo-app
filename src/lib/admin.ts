import { createClient } from "@/lib/supabase/server";

const TITLES = /^(dr|dra|sr|sra)\.?$/i;

export type Admin = { email: string; name: string; firstName: string; initials: string };

export function buildAdmin(meta: Record<string, unknown> | undefined, email: string): Admin {
  const fromMeta = (meta?.full_name ?? meta?.name) as string | undefined;
  const name = fromMeta?.trim() || email.split("@")[0];
  const parts = name.split(/\s+/).filter((p) => p && !TITLES.test(p));
  const firstName = parts[0] ?? name;
  const initials = parts.length === 0 ? "?" : (parts[0][0] + (parts.length > 1 ? parts[parts.length - 1][0] : "")).toUpperCase();
  return { email, name, firstName, initials };
}

/** The signed-in admin, or null. The name comes from the user's metadata (full_name). */
export async function getAdmin(): Promise<Admin | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  return buildAdmin(user.user_metadata, user.email ?? "");
}
