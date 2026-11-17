import type { SupabaseClient } from "@supabase/supabase-js";
import { addDays, formatDayMonth, formatShort, formatWeekdayDate, hhmm, isPresent, todayISO, weekdayOf, type AttendanceStatus } from "@fluxo/domain";
import type { ModalityKey } from "@fluxo/forms";
import { modalityKeyOf } from "./agenda";
import { getOverduePayments, type OverduePayment } from "./payments";

export type SlotClient = { bookingId: string; clientId: string; name: string; status: AttendanceStatus | null; missReason: string | null; modalityKey: ModalityKey | null; label: string | null };
export type Slot = { time: string; clients: SlotClient[] };
export type Pending = { bookingId: string; clientId: string; name: string; when: string };
export type Attention = { clientId: string; name: string; reason: string };
export type Birthday = { clientId: string; name: string; label: string };

export type HomeData = {
  today: string;
  slots: Slot[];
  unmarked: Pending[];
  missingEvolution: Pending[];
  toReschedule: Pending[];
  attention: Attention[];
  birthdays: Birthday[];
  attendance: { rate: number | null; deltaPoints: number | null };
  /** Due dates in the past that the studio did not mark as paid. Empty for instructors (payments are admin-only). */
  payments: { items: OverduePayment[]; total: number };
};

type BookingRow = {
  id: string;
  client_id: string;
  date: string;
  start_time: string;
  status: AttendanceStatus | null;
  miss_reason: string | null;
  modality_id: string | null;
  label: string | null;
  clients: { name: string } | { name: string }[] | null;
  modalities: { key: string } | { key: string }[] | null;
};

const BOOKING_COLUMNS = "id, client_id, date, start_time, status, miss_reason, modality_id, label, clients(name), modalities(key)";

function nameOf(row: BookingRow): string {
  const c = Array.isArray(row.clients) ? row.clients[0] : row.clients;
  return c?.name ?? "Cliente";
}

function fail(label: string, error: { message: string } | null): void {
  if (error) throw new Error(`${label}: ${error.message}`);
}

/** `modalityId` narrows every booking-based section (sessions, pending items, attendance) to one modality. */
export async function getHomeData(supabase: SupabaseClient, modalityId?: string | null): Promise<HomeData> {
  const today = todayISO();
  const yesterday = addDays(today, -1);
  const monthStart = `${today.slice(0, 8)}01`;
  const weekStart = addDays(today, -((weekdayOf(today) + 6) % 7)); // Monday
  const prevWeekStart = addDays(weekStart, -7);

  const [todayRes, yRes, missRes, unjRes, clientsRes, upcomingRes, attRes, payments] = await Promise.all([
    supabase.from("bookings").select(BOOKING_COLUMNS).eq("date", today).order("start_time"),
    supabase.from("bookings").select(BOOKING_COLUMNS).eq("date", yesterday).order("start_time"),
    supabase
      .from("bookings")
      .select(BOOKING_COLUMNS)
      .eq("status", "JUSTIFIED_MISS")
      .gte("date", addDays(today, -7))
      .lte("date", today)
      .order("date"),
    supabase
      .from("bookings")
      .select(BOOKING_COLUMNS)
      .eq("status", "UNJUSTIFIED_MISS")
      .gte("date", monthStart)
      .lte("date", today),
    supabase.from("clients").select("id, name, date_of_birth").eq("active", true),
    supabase.from("bookings").select("client_id, modality_id").gte("date", today).lte("date", addDays(today, 7)),
    supabase.from("bookings").select("date, status, modality_id").gte("date", prevWeekStart).lte("date", today).not("status", "is", null),
    getOverduePayments(supabase, today),
  ]);
  fail("sessões de hoje", todayRes.error);
  fail("sessões de ontem", yRes.error);
  fail("faltas justificadas", missRes.error);
  fail("faltas não justificadas", unjRes.error);
  fail("clientes", clientsRes.error);
  fail("próximas sessões", upcomingRes.error);
  fail("frequência", attRes.error);

  const inScope = <T extends { modality_id: string | null }>(rows: T[]): T[] => (modalityId ? rows.filter((r) => r.modality_id === modalityId) : rows);
  const bookingRows = (res: { data: unknown }) => inScope((res.data ?? []) as BookingRow[]);

  // 1. Today's sessions, grouped by time.
  const slotMap = new Map<string, SlotClient[]>();
  for (const b of bookingRows(todayRes)) {
    const time = hhmm(b.start_time);
    const list = slotMap.get(time) ?? [];
    list.push({ bookingId: b.id, clientId: b.client_id, name: nameOf(b), status: b.status, missReason: b.miss_reason, modalityKey: modalityKeyOf(b.modalities), label: b.label });
    slotMap.set(time, list);
  }
  const slots: Slot[] = [...slotMap.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([time, clients]) => ({ time, clients }));

  // 2. Yesterday: unmarked sessions, and present clients still without an evolution.
  const yesterdayRows = bookingRows(yRes);
  const unmarked: Pending[] = yesterdayRows
    .filter((b) => b.status === null)
    .map((b) => ({ bookingId: b.id, clientId: b.client_id, name: nameOf(b), when: `${formatShort(b.date)}, ${hhmm(b.start_time)}` }));

  // Labelled one-off entries have no evolution form, so they never wait for one.
  const needsEvolution = (b: BookingRow) => isPresent(b.status) && b.modality_id !== null;
  const presentIds = yesterdayRows.filter(needsEvolution).map((b) => b.id);
  let missingEvolution: Pending[] = [];
  if (presentIds.length > 0) {
    const evo = await supabase.from("evolutions").select("booking_id").in("booking_id", presentIds);
    fail("evoluções", evo.error);
    const done = new Set((evo.data ?? []).map((e) => e.booking_id as string));
    missingEvolution = yesterdayRows
      .filter((b) => needsEvolution(b) && !done.has(b.id))
      .map((b) => ({ bookingId: b.id, clientId: b.client_id, name: nameOf(b), when: `${formatShort(b.date)}, ${hhmm(b.start_time)} · sem evolução` }));
  }

  // 3. Justified misses in the last 7 days that nobody has made up yet.
  const missRows = bookingRows(missRes);
  let toReschedule: Pending[] = [];
  if (missRows.length > 0) {
    const made = await supabase.from("bookings").select("replaces_booking_id").in("replaces_booking_id", missRows.map((m) => m.id));
    fail("reposições", made.error);
    const madeUp = new Set((made.data ?? []).map((r) => r.replaces_booking_id as string));
    toReschedule = missRows
      .filter((m) => !madeUp.has(m.id))
      .map((m) => ({ bookingId: m.id, clientId: m.client_id, name: nameOf(m), when: `Falta justificada em ${formatDayMonth(m.date)}${m.miss_reason ? ` · ${m.miss_reason}` : ""}` }));
  }

  // 4. Clients to watch: repeated unjustified misses, or nothing booked for the next 7 days.
  const activeClients = (clientsRes.data ?? []) as { id: string; name: string; date_of_birth: string | null }[];
  const missCount = new Map<string, { name: string; n: number }>();
  for (const b of bookingRows(unjRes)) {
    const entry = missCount.get(b.client_id) ?? { name: nameOf(b), n: 0 };
    entry.n += 1;
    missCount.set(b.client_id, entry);
  }
  const attention: Attention[] = [];
  for (const [clientId, { name, n }] of missCount) {
    if (n >= 2) attention.push({ clientId, name, reason: `${n} faltas não justificadas neste mês` });
  }
  const booked = new Set(inScope((upcomingRes.data ?? []) as { client_id: string; modality_id: string | null }[]).map((r) => r.client_id));
  for (const c of activeClients) {
    if (!booked.has(c.id) && !attention.some((a) => a.clientId === c.id)) {
      attention.push({ clientId: c.id, name: c.name, reason: "Sem sessão nos próximos 7 dias" });
    }
  }

  // 5. Birthdays in the next 7 days.
  const birthdays: Birthday[] = [];
  for (let i = 0; i < 7; i++) {
    const day = addDays(today, i);
    for (const c of activeClients) {
      if (c.date_of_birth && c.date_of_birth.slice(5) === day.slice(5)) {
        birthdays.push({ clientId: c.id, name: c.name, label: i === 0 ? `Hoje, ${formatDayMonth(day)}` : formatWeekdayDate(day) });
      }
    }
  }

  // 6. Attendance rate: present or replacement, out of every marked session this week vs last week.
  const rate = (from: string, to: string): number | null => {
    const rows = inScope((attRes.data ?? []) as { date: string; status: AttendanceStatus; modality_id: string | null }[]).filter((r) => r.date >= from && r.date <= to);
    if (rows.length === 0) return null;
    return Math.round((rows.filter((r) => isPresent(r.status)).length / rows.length) * 100);
  };
  const thisWeek = rate(weekStart, today);
  const lastWeek = rate(prevWeekStart, addDays(weekStart, -1));

  return {
    today,
    slots,
    unmarked,
    missingEvolution,
    toReschedule,
    attention: attention.slice(0, 5),
    birthdays,
    payments,
    attendance: { rate: thisWeek, deltaPoints: thisWeek !== null && lastWeek !== null ? thisWeek - lastWeek : null },
  };
}
