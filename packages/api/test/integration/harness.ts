import { randomUUID } from "node:crypto";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * Integration tests run against a REAL local Supabase (`supabase start`): real Auth, PostgREST, RLS and triggers.
 * They never touch a hosted project. Without the variables below they are skipped, so `npm test` stays hermetic.
 *
 *   SUPABASE_TEST_URL, SUPABASE_TEST_ANON_KEY, SUPABASE_TEST_SERVICE_KEY   (from `supabase status -o env`)
 */
const URL = process.env.SUPABASE_TEST_URL;
const ANON = process.env.SUPABASE_TEST_ANON_KEY;
const SERVICE = process.env.SUPABASE_TEST_SERVICE_KEY;

export const enabled = Boolean(URL && ANON && SERVICE);

if (enabled && !/^https?:\/\/(127\.0\.0\.1|localhost)[:/]/.test(URL!)) {
  throw new Error(`Refusing to run integration tests against ${URL}: only a local Supabase is allowed.`);
}

const opts = { auth: { persistSession: false, autoRefreshToken: false } };

/** Bypasses RLS. Only for arranging test data. */
export const admin = (): SupabaseClient => createClient(URL!, SERVICE!, opts);

export type Person = { id: string; email: string; studioId: string; supabase: SupabaseClient };

let counter = 0;
const unique = () => `${Date.now().toString(36)}${(counter++).toString(36)}${randomUUID().slice(0, 6)}`;

async function modalityIds(): Promise<Record<string, string>> {
  const { data } = await admin().from("modalities").select("id, key");
  return Object.fromEntries((data ?? []).map((m) => [m.key as string, m.id as string]));
}

/** A new studio with the given modalities switched on, and its admin (who teaches all of them, migration 0012). */
export async function newStudio(modalities: string[] = ["pilates"]): Promise<{ studioId: string; admin: Person; modality: Record<string, string> }> {
  const a = admin();
  const all = await modalityIds();
  const { data: studio, error } = await a.from("studios").insert({ name: `Teste ${unique()}` }).select("id").single();
  if (error) throw error;
  const studioId = studio.id as string;
  if (modalities.length) await a.from("studio_modalities").insert(modalities.map((k) => ({ studio_id: studioId, modality_id: all[k] })));
  const person = await newUser(studioId, "admin", []);
  return { studioId, admin: person, modality: all };
}

/** A user in a studio. `teaches` are modality ids (admins already teach everything the studio offers). */
export async function newUser(studioId: string, role: "admin" | "instructor", teaches: string[]): Promise<Person> {
  const a = admin();
  const email = `t-${unique()}@example.test`;
  const password = "Teste-12345";
  const { data, error } = await a.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { full_name: "Teste" } });
  if (error) throw error;
  const id = data.user.id;
  const { error: pe } = await a.from("profiles").insert({ id, email, name: "Teste", role, studio_id: studioId });
  if (pe) throw pe;
  if (role === "instructor" && teaches.length) {
    const { error: me } = await a.from("user_modalities").insert(teaches.map((modality_id) => ({ user_id: id, modality_id })));
    if (me) throw me;
  }
  const supabase = createClient(URL!, ANON!, opts);
  const { error: se } = await supabase.auth.signInWithPassword({ email, password });
  if (se) throw se;
  return { id, email, studioId, supabase };
}

/** A client enrolled in the given modalities, responsible instructor per modality. Created with the service role. */
export async function newClient(studioId: string, enroll: { modalityId: string; instructorId: string | null }[], name = "Cliente Teste"): Promise<string> {
  const a = admin();
  const { data, error } = await a.from("clients").insert({ studio_id: studioId, name, document: `d-${unique()}` }).select("id").single();
  if (error) throw error;
  const id = data.id as string;
  const { error: ee } = await a.from("client_modality_instructors").insert(enroll.map((e) => ({ client_id: id, modality_id: e.modalityId, instructor_id: e.instructorId })));
  if (ee) throw ee;
  return id;
}

export const isoDay = (offset = 0) => new Date(Date.now() + offset * 86400000).toISOString().slice(0, 10);
