import type { SupabaseClient } from "@supabase/supabase-js";
import { statusLabels } from "@fluxo/copy";
import { addDays, formatWeekdayDate, hhmm, todayISO, type AttendanceStatus } from "@fluxo/domain";
import { getForm, isEmptyData, isModalityKey, parseData, summarize, type ModalityKey, type RecordData } from "@fluxo/forms";
import { attempt, friendly, NOT_ALLOWED, touched, type Result } from "./errors";
import { getStudioModalities, type Modality } from "./modalities";

const WEEKDAY_SHORT = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
const keyOf = (m: { key: string } | { key: string }[] | null): ModalityKey | null => {
  const key = Array.isArray(m) ? m[0]?.key : m?.key;
  return isModalityKey(key) ? key : null;
};

// ---------------------------------------------------------------- client header and pickers

export type ClientHead = { id: string; name: string; routine: string };

export async function getClientHead(supabase: SupabaseClient, clientId: string): Promise<ClientHead | null> {
  const [c, s] = await Promise.all([
    supabase.from("clients").select("id, name").eq("id", clientId).maybeSingle(),
    supabase.from("recurring_slots").select("weekday, start_time").eq("client_id", clientId).order("weekday").order("start_time"),
  ]);
  if (!c.data) return null;
  const routine = (s.data ?? []).map((r) => `${WEEKDAY_SHORT[r.weekday as number]} ${hhmm(r.start_time as string)}`).join(", ");
  return { id: c.data.id as string, name: c.data.name as string, routine };
}

/** The modalities a client is enrolled in that the signed-in user can see (RLS: an instructor sees only their own). */
export async function getClientModalities(supabase: SupabaseClient, clientId: string): Promise<Modality[]> {
  const [studio, rows] = await Promise.all([getStudioModalities(supabase), supabase.from("client_modality_instructors").select("modality_id").eq("client_id", clientId)]);
  if (rows.error) throw new Error(`modalidades do cliente: ${rows.error.message}`);
  const ids = new Set((rows.data ?? []).map((r) => r.modality_id as string));
  return studio.filter((m) => ids.has(m.id));
}

export type SessionOption = { id: string; date: string; label: string };

/** Sessions of this modality where the client was present (or made a replacement) that have no evolution yet. */
export async function getSessionOptions(supabase: SupabaseClient, clientId: string, modalityId: string, keepBookingId?: string | null): Promise<SessionOption[]> {
  const today = todayISO();
  const { data, error } = await supabase
    .from("bookings")
    .select("id, date, start_time, status")
    .eq("client_id", clientId)
    .eq("modality_id", modalityId)
    .in("status", ["PRESENCE_CONFIRMED", "REPLACEMENT"])
    .gte("date", addDays(today, -120))
    .lte("date", addDays(today, 1))
    .order("date", { ascending: false })
    .order("start_time", { ascending: false });
  if (error) throw new Error(`sessões: ${error.message}`);
  const rows = data ?? [];
  if (rows.length === 0) return [];

  const used = await supabase.from("evolutions").select("booking_id").in("booking_id", rows.map((r) => r.id as string));
  const taken = new Set((used.data ?? []).map((u) => u.booking_id as string));
  return rows
    .filter((r) => !taken.has(r.id as string) || r.id === keepBookingId)
    .map((r) => ({
      id: r.id as string,
      date: r.date as string,
      label: `${formatWeekdayDate(r.date as string)}, ${hhmm(r.start_time as string)} · ${statusLabels[r.status as AttendanceStatus]}`,
    }));
}

/** How many evolutions the client already has in a modality: the next session number is this plus one. */
export async function countEvolutions(supabase: SupabaseClient, clientId: string, modalityId: string): Promise<number> {
  const { count, error } = await supabase.from("evolutions").select("id", { count: "exact", head: true }).eq("client_id", clientId).eq("modality_id", modalityId);
  if (error) throw new Error(`evoluções: ${error.message}`);
  return count ?? 0;
}

/** The modality a linked session belongs to (the evolution form follows it). */
export async function getBookingModality(supabase: SupabaseClient, bookingId: string, clientId: string): Promise<string | null> {
  const { data } = await supabase.from("bookings").select("modality_id").eq("id", bookingId).eq("client_id", clientId).maybeSingle();
  return (data?.modality_id as string | null | undefined) ?? null;
}

// ---------------------------------------------------------------- evolutions

export const EVOLUTIONS_PAGE_SIZE = 10;

export type EvolutionListItem = { id: string; date: string; sessionNumber: number; modality: ModalityKey | null; title: string; text: string; extra: number };

export async function listEvolutions(supabase: SupabaseClient, clientId: string, opts: { modalityId?: string | null; page?: number } = {}): Promise<{ items: EvolutionListItem[]; total: number; page: number; lastPage: number }> {
  const page = Math.max(1, opts.page ?? 1);
  const from = (page - 1) * EVOLUTIONS_PAGE_SIZE;
  let query = supabase
    .from("evolutions")
    .select("id, date, session_number, data, modalities(key)", { count: "exact" })
    .eq("client_id", clientId)
    .order("date", { ascending: false })
    .order("created_at", { ascending: false })
    .range(from, from + EVOLUTIONS_PAGE_SIZE - 1);
  if (opts.modalityId) query = query.eq("modality_id", opts.modalityId);
  const { data, count, error } = await query;
  if (error) throw new Error(`evoluções: ${error.message}`);
  const rows = (data ?? []) as unknown as { id: string; date: string; session_number: number; data: RecordData; modalities: { key: string } | { key: string }[] | null }[];
  const total = count ?? 0;
  return {
    total,
    page,
    lastPage: Math.max(1, Math.ceil(total / EVOLUTIONS_PAGE_SIZE)),
    items: rows.map((r) => {
      const modality = keyOf(r.modalities);
      const s = modality ? summarize(getForm(modality, "evolution"), r.data) : { title: "Evolução", text: "", extra: 0 };
      return { id: r.id, date: r.date, sessionNumber: r.session_number, modality, title: s.title, text: s.text, extra: s.extra };
    }),
  };
}

export type EvolutionRecord = { id: string; date: string; bookingId: string | null; modalityId: string; modality: ModalityKey; sessionNumber: number; data: RecordData };

export async function getEvolution(supabase: SupabaseClient, clientId: string, evolutionId: string): Promise<EvolutionRecord | null> {
  const { data, error } = await supabase
    .from("evolutions")
    .select("id, date, booking_id, modality_id, session_number, data, modalities(key)")
    .eq("id", evolutionId)
    .eq("client_id", clientId)
    .maybeSingle();
  if (error) throw new Error(`evolução: ${error.message}`);
  if (!data) return null;
  const modality = keyOf(data.modalities as { key: string } | { key: string }[] | null);
  if (!modality) return null;
  return { id: data.id as string, date: data.date as string, bookingId: (data.booking_id as string | null) ?? null, modalityId: data.modality_id as string, modality, sessionNumber: data.session_number as number, data: data.data as RecordData };
}

const DATE = /^\d{4}-\d{2}-\d{2}$/;

async function resolveModality(supabase: SupabaseClient, key: string): Promise<Modality | null> {
  if (!isModalityKey(key)) return null;
  return (await getStudioModalities(supabase)).find((m) => m.key === key) ?? null;
}

export type SaveEvolutionInput = { clientId: string; modality: string; evolutionId: string | null; date: string; bookingId: string | null; sessionNumber: number; data: unknown };

/** Validates against the modality's form definition (unknown keys rejected, empty values dropped) and saves. */
export function saveEvolution(supabase: SupabaseClient, input: SaveEvolutionInput): Promise<Result & { id?: string }> {
  return attempt(async () => {
    if (!DATE.test(input.date)) return { error: "Informe a data." };
    if (!Number.isInteger(input.sessionNumber) || input.sessionNumber < 1) return { error: "Informe o número da sessão." };
    const modality = await resolveModality(supabase, input.modality);
    if (!modality) return { error: "Modalidade inválida." };
    const def = getForm(modality.key, "evolution");
    const parsed = parseData(def, input.data ?? {});
    if (!parsed.ok) return { error: parsed.error };
    if (isEmptyData(def, parsed.data)) return { error: "Preencha ao menos um campo da evolução." };

    const row = { date: input.date, booking_id: input.bookingId, session_number: input.sessionNumber, data: parsed.data, schema_version: def.schemaVersion };
    if (input.evolutionId) {
      const { data, error } = await supabase.from("evolutions").update(row).eq("id", input.evolutionId).eq("client_id", input.clientId).select("id");
      if (error) return { error: friendly(error) };
      return touched(data) ? { id: input.evolutionId } : { error: NOT_ALLOWED };
    }
    const { data, error } = await supabase.from("evolutions").insert({ ...row, client_id: input.clientId, modality_id: modality.id }).select("id").single();
    if (error) return { error: friendly(error) };
    return { id: data.id as string };
  });
}

export function deleteEvolution(supabase: SupabaseClient, clientId: string, evolutionId: string): Promise<Result> {
  return attempt(async () => {
    const { data, error } = await supabase.from("evolutions").delete().eq("id", evolutionId).eq("client_id", clientId).select("id");
    if (error) return { error: friendly(error) };
    return touched(data) ? {} : { error: NOT_ALLOWED };
  });
}

// ---------------------------------------------------------------- evaluations

export type EvaluationItem = { id: string; date: string; modality: ModalityKey; modalityId: string; /** "Avaliação inicial" or "Reavaliação". */ title: string; text: string; data: RecordData };

/** Newest first. Within a modality the oldest evaluation is the initial one. */
export async function listEvaluations(supabase: SupabaseClient, clientId: string, modalityId?: string | null): Promise<EvaluationItem[]> {
  let query = supabase.from("evaluations").select("id, date, data, modality_id, modalities(key)").eq("client_id", clientId).order("date", { ascending: false }).order("created_at", { ascending: false });
  if (modalityId) query = query.eq("modality_id", modalityId);
  const { data, error } = await query;
  if (error) throw new Error(`avaliações: ${error.message}`);
  const found = ((data ?? []) as unknown as { id: string; date: string; data: RecordData; modality_id: string; modalities: { key: string } | { key: string }[] | null }[]).filter((r) => keyOf(r.modalities));
  return found.map((r) => {
    const same = found.filter((x) => x.modality_id === r.modality_id);
    const modality = keyOf(r.modalities)!;
    return {
      id: r.id,
      date: r.date,
      modality,
      modalityId: r.modality_id,
      title: same[same.length - 1].id === r.id ? "Avaliação inicial" : "Reavaliação",
      text: summarize(getForm(modality, "evaluation"), r.data).text,
      data: r.data,
    };
  });
}

export type SaveEvaluationInput = { clientId: string; modality: string; evaluationId: string | null; date: string; data: unknown };

export function saveEvaluation(supabase: SupabaseClient, input: SaveEvaluationInput): Promise<Result> {
  return attempt(async () => {
    if (!DATE.test(input.date)) return { error: "Informe a data." };
    const modality = await resolveModality(supabase, input.modality);
    if (!modality) return { error: "Modalidade inválida." };
    const def = getForm(modality.key, "evaluation");
    const parsed = parseData(def, input.data ?? {});
    if (!parsed.ok) return { error: parsed.error };

    const row = { date: input.date, data: parsed.data, schema_version: def.schemaVersion };
    if (input.evaluationId) {
      const { data, error } = await supabase.from("evaluations").update(row).eq("id", input.evaluationId).eq("client_id", input.clientId).select("id");
      if (error) return { error: friendly(error) };
      return touched(data) ? {} : { error: NOT_ALLOWED };
    }
    const { error } = await supabase.from("evaluations").insert({ ...row, client_id: input.clientId, modality_id: modality.id });
    return error ? { error: friendly(error) } : {};
  });
}

export function deleteEvaluation(supabase: SupabaseClient, clientId: string, evaluationId: string): Promise<Result> {
  return attempt(async () => {
    const { data, error } = await supabase.from("evaluations").delete().eq("id", evaluationId).eq("client_id", clientId).select("id");
    if (error) return { error: friendly(error) };
    return touched(data) ? {} : { error: NOT_ALLOWED };
  });
}
