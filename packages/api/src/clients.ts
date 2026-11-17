import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { formatShort, hhmm, todayISO } from "@fluxo/domain";
import type { ModalityKey } from "@fluxo/forms";
import { attempt, friendly, NOT_ALLOWED, touched, type Result } from "./errors";
import { getStudioModalities, getTeachableModalities, type Modality } from "./modalities";
import type { Me } from "./profile";

// ---------------------------------------------------------------- shapes

const nullable = <T extends z.ZodTypeAny>(s: T) => s.nullable();

export const clientSchema = z.object({
  document: z.string().min(1, "Informe o documento."),
  name: z.string().min(2, "Informe o nome."),
  email: nullable(z.string().email("E-mail inválido.")),
  phone: nullable(z.string()),
  emergency_contact_name: nullable(z.string()),
  emergency_contact_phone: nullable(z.string()),
  date_of_birth: nullable(z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Data de nascimento inválida.")),
  // Shared client data (the same for every modality), filled once.
  sex: nullable(z.enum(["female", "male", "other"], { message: "Sexo inválido." })),
  marital_status: nullable(z.enum(["single", "married", "stable_union", "divorced", "widowed"], { message: "Estado civil inválido." })),
  city: nullable(z.string().max(120)),
  profession: nullable(z.string().max(120)),
  workplace: nullable(z.string().max(120)),
  children: nullable(z.string().max(300)),
  parents: nullable(z.string().max(300)),
});

/** The personal and shared fields of a client. Empty strings must already be `null`. */
export type ClientInput = z.input<typeof clientSchema>;

/** The history lists, saved with the personal data. */
export type ClientLists = { diseases: string[]; surgeries: string[]; current_treatments: string[]; previous_treatments: string[]; medications: string[] };

/** One modality the client is enrolled in, with the responsible instructor (or none). */
export type EnrollmentInput = { modalityId: string; instructorId: string | null };

const uuid = z.string().uuid();

/** Validates the ticked modalities. An instructor enrolling a client is the responsible one; only admins pick. */
function checkEnrollments(list: EnrollmentInput[], allowed: Modality[], me: Pick<Me, "id" | "role">): EnrollmentInput[] | string {
  const out: EnrollmentInput[] = [];
  for (const e of list) {
    if (!allowed.some((m) => m.id === e.modalityId)) return "Modalidade inválida.";
    const instructorId = me.role === "admin" ? e.instructorId : me.id;
    if (instructorId !== null && !uuid.safeParse(instructorId).success) return "Instrutor inválido.";
    out.push({ modalityId: e.modalityId, instructorId });
  }
  if (out.length === 0) return "Escolha ao menos uma modalidade.";
  return out;
}

// ---------------------------------------------------------------- list

export const CLIENTS_PAGE_SIZE = 10;
export type ClientSituation = "ativos" | "arquivados";

export type ClientListItem = {
  id: string;
  name: string;
  phone: string | null;
  active: boolean;
  modalityIds: string[];
  /** "Seg 05/10, 07:00", or null when nothing is booked ahead. */
  nextSession: string | null;
  /** Recurring weekly slots. */
  weeklyCount: number;
};

/** Characters that would break the PostgREST `or()` filter. */
export function searchTerm(raw: string | undefined): string {
  return (raw ?? "").replace(/[,()%*]/g, " ").trim();
}

export async function listClients(supabase: SupabaseClient, opts: { q?: string; situation?: ClientSituation; page?: number }): Promise<{ items: ClientListItem[]; total: number; page: number; lastPage: number }> {
  const situation = opts.situation ?? "ativos";
  const q = searchTerm(opts.q);
  const page = Math.max(1, opts.page ?? 1);
  const from = (page - 1) * CLIENTS_PAGE_SIZE;

  let query = supabase
    .from("clients")
    .select("id, name, phone, active, client_modality_instructors(modality_id)", { count: "exact" })
    .eq("active", situation === "ativos")
    .order("name")
    .range(from, from + CLIENTS_PAGE_SIZE - 1);
  if (q) query = query.or(`name.ilike.%${q}%,document.ilike.%${q}%`);

  const { data, count, error } = await query;
  if (error) throw new Error(`clientes: ${error.message}`);
  const rows = (data ?? []) as unknown as { id: string; name: string; phone: string | null; active: boolean; client_modality_instructors: { modality_id: string }[] | null }[];
  const ids = rows.map((c) => c.id);
  const today = todayISO();

  // Next session and weekly frequency for the clients on this page.
  const nextBy = new Map<string, string>();
  const freqBy = new Map<string, number>();
  if (ids.length > 0) {
    const [nextRes, slotsRes] = await Promise.all([
      supabase
        .from("bookings")
        .select("client_id, date, start_time")
        .in("client_id", ids)
        .gte("date", today)
        .or("status.is.null,status.eq.PRESENCE_CONFIRMED,status.eq.REPLACEMENT")
        .order("date")
        .order("start_time")
        .limit(500),
      supabase.from("recurring_slots").select("client_id").in("client_id", ids).or(`active_until.is.null,active_until.gte.${today}`),
    ]);
    if (nextRes.error) throw new Error(`próximas sessões: ${nextRes.error.message}`);
    if (slotsRes.error) throw new Error(`horários fixos: ${slotsRes.error.message}`);
    for (const b of nextRes.data ?? []) {
      const id = b.client_id as string;
      if (!nextBy.has(id)) nextBy.set(id, `${formatShort(b.date as string)}, ${hhmm(b.start_time as string)}`);
    }
    for (const s of slotsRes.data ?? []) freqBy.set(s.client_id as string, (freqBy.get(s.client_id as string) ?? 0) + 1);
  }

  const total = count ?? 0;
  return {
    total,
    page,
    lastPage: Math.max(1, Math.ceil(total / CLIENTS_PAGE_SIZE)),
    items: rows.map((c) => ({
      id: c.id,
      name: c.name,
      phone: c.phone,
      active: c.active,
      modalityIds: (c.client_modality_instructors ?? []).map((e) => e.modality_id),
      nextSession: c.active ? (nextBy.get(c.id) ?? null) : null,
      weeklyCount: freqBy.get(c.id) ?? 0,
    })),
  };
}

// ---------------------------------------------------------------- detail

export type ClientRecord = ClientLists & {
  id: string;
  document: string;
  name: string;
  email: string | null;
  phone: string | null;
  emergency_contact_name: string | null;
  emergency_contact_phone: string | null;
  date_of_birth: string | null;
  sex: string | null;
  marital_status: string | null;
  city: string | null;
  profession: string | null;
  workplace: string | null;
  children: string | null;
  parents: string | null;
  active: boolean;
};

export type WeeklySlot = { id: string; weekday: number; hour: number; modalityId: string };

/** Monday first, the order the week reads in. */
export const WEEKDAY_ORDER = [1, 2, 3, 4, 5, 6, 0] as const;

export type ClientDetail = {
  client: ClientRecord;
  /** Active recurring slots, Monday first then by hour. */
  slots: WeeklySlot[];
  /** Enrollment as the signed-in person can see it (an instructor: only the modalities they are responsible for). */
  enrollment: { modalityId: string; instructorId: string | null }[];
};

export async function getClientDetail(supabase: SupabaseClient, id: string): Promise<ClientDetail | null> {
  const [c, s, e] = await Promise.all([
    supabase.from("clients").select("*").eq("id", id).maybeSingle(),
    supabase.from("recurring_slots").select("id, weekday, start_time, active_until, modality_id").eq("client_id", id).order("weekday").order("start_time"),
    supabase.from("client_modality_instructors").select("modality_id, instructor_id").eq("client_id", id),
  ]);
  if (c.error) throw new Error(`cliente: ${c.error.message}`);
  if (!c.data) return null;
  const today = todayISO();
  const slots = ((s.data ?? []) as { id: string; weekday: number; start_time: string; active_until: string | null; modality_id: string }[])
    .filter((r) => !r.active_until || r.active_until >= today)
    .map((r) => ({ id: r.id, weekday: r.weekday, hour: Number(r.start_time.slice(0, 2)), modalityId: r.modality_id }))
    .sort((a, b) => WEEKDAY_ORDER.indexOf(a.weekday as never) - WEEKDAY_ORDER.indexOf(b.weekday as never) || a.hour - b.hour);
  const client = c.data as ClientRecord;
  return {
    client: { ...client, diseases: client.diseases ?? [], surgeries: client.surgeries ?? [], current_treatments: client.current_treatments ?? [], previous_treatments: client.previous_treatments ?? [], medications: client.medications ?? [] },
    slots,
    enrollment: ((e.data ?? []) as { modality_id: string; instructor_id: string | null }[]).map((r) => ({ modalityId: r.modality_id, instructorId: r.instructor_id })),
  };
}

// ---------------------------------------------------------------- mutations

export type CreateClientResult = Result & { id?: string; modalityKeys?: ModalityKey[] };

/** Creates a client and enrolls them. A client nobody is enrolled for is never left behind. */
export function registerClient(supabase: SupabaseClient, me: Pick<Me, "id" | "role" | "studioId">, input: ClientInput, enrollments: EnrollmentInput[]): Promise<CreateClientResult> {
  return attempt(async () => {
    const parsed = clientSchema.safeParse(input);
    if (!parsed.success) return { error: parsed.error.issues[0].message };
    if (!me.studioId) return { error: "Sessão expirada. Entre novamente." };
    const allowed = await getTeachableModalities(supabase, me);
    const checked = checkEnrollments(enrollments, allowed, me);
    if (typeof checked === "string") return { error: checked };

    const { data, error } = await supabase.from("clients").insert({ ...parsed.data, studio_id: me.studioId }).select("id").single();
    if (error) return { error: friendly(error) };
    const id = data.id as string;

    const { error: enrollError } = await supabase.from("client_modality_instructors").insert(checked.map((e) => ({ client_id: id, modality_id: e.modalityId, instructor_id: e.instructorId })));
    if (enrollError) {
      await supabase.from("clients").delete().eq("id", id);
      return { error: friendly(enrollError) };
    }
    return { id, modalityKeys: checked.map((e) => allowed.find((m) => m.id === e.modalityId)!.key) };
  });
}

/**
 * Saves the personal data and history lists. Only admins change who is responsible and which modalities the client
 * is in: pass `enrollments` and it is applied for admins, ignored for everyone else.
 */
export function updateClient(supabase: SupabaseClient, me: Pick<Me, "id" | "role">, clientId: string, input: ClientInput, lists: ClientLists, enrollments?: EnrollmentInput[]): Promise<Result> {
  return attempt(async () => {
    const parsed = clientSchema.safeParse(input);
    if (!parsed.success) return { error: parsed.error.issues[0].message };
    const clean = (l: string[]) => l.map((v) => v.trim()).filter(Boolean);
    const { data: updated, error } = await supabase
      .from("clients")
      .update({
        ...parsed.data,
        diseases: clean(lists.diseases),
        surgeries: clean(lists.surgeries),
        current_treatments: clean(lists.current_treatments),
        previous_treatments: clean(lists.previous_treatments),
        medications: clean(lists.medications),
      })
      .eq("id", clientId)
      .select("id");
    if (error) return { error: friendly(error) };
    if (!touched(updated)) return { error: NOT_ALLOWED };

    if (me.role === "admin" && enrollments) {
      const checked = checkEnrollments(enrollments, await getStudioModalities(supabase), me);
      if (typeof checked === "string") return { error: checked };
      const { data: current, error: currentError } = await supabase.from("client_modality_instructors").select("modality_id").eq("client_id", clientId);
      if (currentError) return { error: friendly(currentError) };
      const had = new Set((current ?? []).map((r) => r.modality_id as string));
      const want = new Set(checked.map((e) => e.modalityId));

      const { error: upsertError } = await supabase
        .from("client_modality_instructors")
        .upsert(checked.map((e) => ({ client_id: clientId, modality_id: e.modalityId, instructor_id: e.instructorId })), { onConflict: "client_id,modality_id" });
      if (upsertError) return { error: friendly(upsertError) };

      const removed = [...had].filter((m) => !want.has(m));
      if (removed.length > 0) {
        const { error: removeError } = await supabase.from("client_modality_instructors").delete().eq("client_id", clientId).in("modality_id", removed);
        if (removeError) return { error: friendly(removeError) };
      }
    }
    return {};
  });
}

/** Archiving removes future, still-unmarked sessions; everything already marked stays as history. Reactivating regenerates them. */
export function setArchived(supabase: SupabaseClient, clientId: string, archived: boolean): Promise<Result> {
  return attempt(async () => {
    const { data, error } = await supabase.from("clients").update({ active: !archived }).eq("id", clientId).select("id");
    if (error) return { error: friendly(error) };
    if (!touched(data)) return { error: NOT_ALLOWED };
    if (archived) await supabase.from("bookings").delete().eq("client_id", clientId).gte("date", todayISO()).is("status", null);
    else await supabase.rpc("generate_bookings", { weeks: 8 });
    return {};
  });
}

const slotSchema = z.object({
  weekday: z.coerce.number().int().min(0).max(6),
  hour: z.coerce.number().int().min(6).max(20),
  modalityId: z.string().uuid("Escolha a modalidade."),
});

export function addRecurringSlot(supabase: SupabaseClient, clientId: string, input: { weekday: number; hour: number; modalityId: string }): Promise<Result> {
  return attempt(async () => {
    const parsed = slotSchema.safeParse(input);
    if (!parsed.success) return { error: parsed.error.issues[0].message };
    const { error } = await supabase.from("recurring_slots").insert({
      client_id: clientId,
      modality_id: parsed.data.modalityId,
      weekday: parsed.data.weekday,
      start_time: `${String(parsed.data.hour).padStart(2, "0")}:00`,
      active_from: todayISO(),
    });
    if (error) return { error: friendly(error) };
    await supabase.rpc("generate_bookings", { weeks: 8 });
    return {};
  });
}

/** Future sessions generated from this slot disappear, unless they were already marked. */
export function removeRecurringSlot(supabase: SupabaseClient, slotId: string): Promise<Result> {
  return attempt(async () => {
    await supabase.from("bookings").delete().eq("recurring_slot_id", slotId).gte("date", todayISO()).is("status", null);
    const { error } = await supabase.from("recurring_slots").delete().eq("id", slotId);
    return error ? { error: friendly(error) } : {};
  });
}

