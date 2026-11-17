import type { SupabaseClient } from "@supabase/supabase-js";
import { MODALITY_LABELS, isModalityKey, type ModalityKey } from "@fluxo/forms";
import type { Me } from "./profile";

export type Modality = { id: string; key: ModalityKey; name: string };

type Row = { id: string; key: string; name_pt: string };

function toModality(r: Row): Modality | null {
  return isModalityKey(r.key) ? { id: r.id, key: r.key, name: MODALITY_LABELS[r.key] ?? r.name_pt } : null;
}

/** Every modality Fluxo ships (the seed table). Rows with a key this build does not know are skipped. */
export async function getModalities(supabase: SupabaseClient): Promise<Modality[]> {
  const { data, error } = await supabase.from("modalities").select("id, key, name_pt").order("sort");
  if (error) throw new Error(`modalidades: ${error.message}`);
  return ((data ?? []) as Row[]).map(toModality).filter((m): m is Modality => m !== null);
}

/** The modalities the signed-in user's studio has switched on. */
export async function getStudioModalities(supabase: SupabaseClient): Promise<Modality[]> {
  const [all, enabled] = await Promise.all([getModalities(supabase), supabase.from("studio_modalities").select("modality_id")]);
  if (enabled.error) throw new Error(`modalidades do estúdio: ${enabled.error.message}`);
  const ids = new Set((enabled.data ?? []).map((r) => r.modality_id as string));
  return all.filter((m) => ids.has(m.id));
}

/**
 * The modalities this user can schedule and assign clients in: an instructor, the ones they teach;
 * an admin manages the whole studio, so every modality the studio offers.
 */
export async function getTeachableModalities(supabase: SupabaseClient, me: Pick<Me, "id" | "role">): Promise<Modality[]> {
  const studio = await getStudioModalities(supabase);
  if (me.role === "admin") return studio;
  const { data, error } = await supabase.from("user_modalities").select("modality_id").eq("user_id", me.id);
  if (error) throw new Error(`modalidades do usuário: ${error.message}`);
  const mine = new Set((data ?? []).map((r) => r.modality_id as string));
  return studio.filter((m) => mine.has(m.id));
}

/** Resolves a modality key (e.g. a `?mod=` search param) against a list. */
export function pickModality(value: string | undefined, list: Modality[]): Modality | null {
  return list.find((m) => m.key === value) ?? null;
}

export type Instructor = { id: string; name: string };

/** Who teaches what, for the "responsible instructor" pickers. Admins see the whole studio; anyone else only themselves. */
export async function getInstructorsByModality(supabase: SupabaseClient): Promise<Map<string, Instructor[]>> {
  const { data, error } = await supabase.from("user_modalities").select("modality_id, profiles(id, name)");
  if (error) throw new Error(`instrutores: ${error.message}`);
  const out = new Map<string, Instructor[]>();
  for (const r of (data ?? []) as unknown as { modality_id: string; profiles: Instructor | Instructor[] | null }[]) {
    const p = Array.isArray(r.profiles) ? r.profiles[0] : r.profiles;
    if (!p) continue;
    out.set(r.modality_id, [...(out.get(r.modality_id) ?? []), p].sort((a, b) => a.name.localeCompare(b.name)));
  }
  return out;
}
