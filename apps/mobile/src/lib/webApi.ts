import type { Result } from "@fluxo/api";
import { supabase } from "./supabase";

const BASE = (process.env.EXPO_PUBLIC_WEB_URL ?? "").replace(/\/+$/, "");

/**
 * Calls the few web routes that need the service-role key (inviting and removing users), authenticated with the
 * signed-in person's access token. The web checks the token and that they are an admin; the key never reaches the app.
 */
export async function callWeb(path: string, init: { method: "POST" | "DELETE"; body?: unknown }): Promise<Result> {
  if (!BASE) return { error: "Defina EXPO_PUBLIC_WEB_URL (veja .env.example)." };
  try {
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    if (!token) return { error: "Sessão expirada. Entre novamente." };
    const res = await fetch(`${BASE}${path}`, {
      method: init.method,
      headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
      body: init.body ? JSON.stringify(init.body) : undefined,
    });
    if (res.ok) return {};
    const json = (await res.json().catch(() => null)) as { error?: string } | null;
    return { error: json?.error ?? "Não foi possível concluir. Tente de novo." };
  } catch (e) {
    return { error: e instanceof Error ? e.message : String(e) };
  }
}
