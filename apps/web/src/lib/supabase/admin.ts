import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { supabaseEnv } from "./env";

/**
 * Service-role client. Bypasses RLS entirely — only for admin-only auth operations
 * (inviting/removing a user) that the anon key cannot perform. Never import this from
 * client code; it must only run inside Server Actions, and only after checking the
 * caller is an admin.
 */
export function createAdminClient() {
  const { url } = supabaseEnv();
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) throw new Error("Defina SUPABASE_SERVICE_ROLE_KEY (veja .env.example).");
  return createSupabaseClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
}
