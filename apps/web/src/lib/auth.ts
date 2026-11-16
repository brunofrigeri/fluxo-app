import { createClient } from "@/lib/supabase/server";

export { friendly } from "@fluxo/api";

/** A Supabase client for a signed-in admin. Throws when the session is gone. */
export async function db() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Sessão expirada. Entre novamente.");
  return supabase;
}
