import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { supabaseEnv } from "@/lib/supabase/env";

/**
 * A Supabase client acting as the person whose access token is in the `Authorization: Bearer` header, for the route
 * handlers the mobile app calls (it has no cookies). Everything then runs under that person's RLS, exactly like a
 * cookie session. Returns null when there is no token.
 */
export function clientFromBearer(req: Request): SupabaseClient | null {
  const header = req.headers.get("authorization") ?? "";
  const token = header.toLowerCase().startsWith("bearer ") ? header.slice(7).trim() : "";
  if (!token) return null;
  const { url, key } = supabaseEnv();
  return createClient(url, key, { global: { headers: { Authorization: `Bearer ${token}` } }, auth: { persistSession: false, autoRefreshToken: false } });
}

/** The origin an invite link should return to: this deployment. */
export function originOf(req: Request): string {
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host") ?? "localhost:3000";
  const proto = req.headers.get("x-forwarded-proto") ?? (host.startsWith("localhost") || host.startsWith("127.") ? "http" : "https");
  return `${proto}://${host}`;
}
