import type { SupabaseClient } from "@supabase/supabase-js";
import { waitSchema, type Period } from "@fluxo/domain";
import { attempt, friendly, NOT_ALLOWED, touched, type Result } from "./errors";
import { getStudioModalities } from "./modalities";

export type WaitEntry = { id: string; name: string; phone: string; period: Period; createdAt: string; modalityId: string };
export type WaitInput = { name: string; phone: string; period: string; modalityId: string };

/**
 * Everyone waiting for a vaga, first in first listed. Entries for a modality the studio has switched off are hidden
 * (and kept, in case it is switched back on).
 */
export async function getWaitList(supabase: SupabaseClient): Promise<WaitEntry[]> {
  const [{ data, error }, modalities] = await Promise.all([
    supabase.from("wait_list").select("id, name, phone, period, created_at, modality_id").order("created_at"),
    getStudioModalities(supabase),
  ]);
  if (error) throw new Error(`lista de espera: ${error.message}`);
  const on = new Set(modalities.map((m) => m.id));
  return ((data ?? []) as { id: string; name: string; phone: string; period: Period; created_at: string; modality_id: string }[])
    .filter((r) => on.has(r.modality_id))
    .map((r) => ({ id: r.id, name: r.name, phone: r.phone, period: r.period, createdAt: r.created_at, modalityId: r.modality_id }));
}

async function validate(supabase: SupabaseClient, input: WaitInput): Promise<{ error: string } | { data: { name: string; phone: string; period: Period; modality_id: string } }> {
  const parsed = waitSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const { modalityId, ...rest } = parsed.data;
  if (!(await getStudioModalities(supabase)).some((m) => m.id === modalityId)) return { error: "Modalidade inválida." };
  return { data: { ...rest, modality_id: modalityId } };
}

export function addToWaitList(supabase: SupabaseClient, studioId: string | null, input: WaitInput): Promise<Result> {
  return attempt(async () => {
    if (!studioId) return { error: "Sessão expirada. Entre novamente." };
    const v = await validate(supabase, input);
    if ("error" in v) return v;
    const { error } = await supabase.from("wait_list").insert({ ...v.data, studio_id: studioId });
    return error ? { error: friendly(error) } : {};
  });
}

export function updateWaitEntry(supabase: SupabaseClient, id: string, input: WaitInput): Promise<Result> {
  return attempt(async () => {
    const v = await validate(supabase, input);
    if ("error" in v) return v;
    const { data, error } = await supabase.from("wait_list").update(v.data).eq("id", id).select("id");
    if (error) return { error: friendly(error) };
    return touched(data) ? {} : { error: NOT_ALLOWED };
  });
}

export function removeFromWaitList(supabase: SupabaseClient, id: string): Promise<Result> {
  return attempt(async () => {
    const { data, error } = await supabase.from("wait_list").delete().eq("id", id).select("id");
    if (error) return { error: friendly(error) };
    return touched(data) ? {} : { error: NOT_ALLOWED };
  });
}
