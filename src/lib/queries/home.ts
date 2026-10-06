import { createClient } from "@/lib/supabase/server";
import { addDays, formatDayMonth, formatShort, formatWeekdayDate, hhmm, todayISO, weekdayOf } from "@/lib/dates";
import { isPresent, type AttendanceStatus } from "@/lib/status";

export type SlotClient = { bookingId: string; clientId: string; name: string; status: AttendanceStatus | null; missReason: string | null };
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
};

type BookingRow = {
  id: string;
  client_id: string;
  date: string;
  start_time: string;
  status: AttendanceStatus | null;
  miss_reason: string | null;
  clients: { name: string } | { name: string }[] | null;
};

function nameOf(row: BookingRow): string {
  const c = Array.isArray(row.clients) ? row.clients[0] : row.clients;
  return c?.name ?? "Cliente";
}

function fail(label: string, error: { message: string } | null): void {
  if (error) throw new Error(`${label}: ${error.message}`);
}

export async function getHomeData(): Promise<HomeData> {
  const supabase = await createClient();
  const today = todayISO();
  const yesterday = addDays(today, -1);
  const monthStart = `${today.slice(0, 8)}01`;
  const weekStart = addDays(today, -((weekdayOf(today) + 6) % 7)); // Monday
  const prevWeekStart = addDays(weekStart, -7);

  const [todayRes, yRes, missRes, unjRes, clientsRes, upcomingRes, attRes] = await Promise.all([
    supabase.from("bookings").select("id, client_id, date, start_time, status, miss_reason, clients(name)").eq("date", today).order("start_time"),
    supabase.from("bookings").select("id, client_id, date, start_time, status, miss_reason, clients(name)").eq("date", yesterday).order("start_time"),
    supabase
      .from("bookings")
      .select("id, client_id, date, start_time, status, miss_reason, clients(name)")
      .eq("status", "JUSTIFIED_MISS")
      .gte("date", addDays(today, -7))
      .lte("date", today)
      .order("date"),
    supabase
      .from("bookings")
      .select("id, client_id, date, start_time, status, miss_reason, clients(name)")
      .eq("status", "UNJUSTIFIED_MISS")
      .gte("date", monthStart)
      .lte("date", today),
    supabase.from("clients").select("id, name, date_of_birth").eq("active", true),
    supabase.from("bookings").select("client_id").gte("date", today).lte("date", addDays(today, 7)),
    supabase.from("bookings").select("date, status").gte("date", prevWeekStart).lte("date", today).not("status", "is", null),
  ]);
  fail("sessões de hoje", todayRes.error);
  fail("sessões de ontem", yRes.error);
  fail("faltas justificadas", missRes.error);
  fail("faltas não justificadas", unjRes.error);
  fail("clientes", clientsRes.error);
  fail("próximas sessões", upcomingRes.error);
  fail("frequência", attRes.error);

  // 1. Today's sessions, grouped by time.
  const slotMap = new Map<string, SlotClient[]>();
  for (const b of (todayRes.data ?? []) as unknown as BookingRow[]) {
    const time = hhmm(b.start_time);
    const list = slotMap.get(time) ?? [];
    list.push({ bookingId: b.id, clientId: b.client_id, name: nameOf(b), status: b.status, missReason: b.miss_reason });
    slotMap.set(time, list);
  }
  const slots: Slot[] = [...slotMap.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([time, clients]) => ({ time, clients }));

  // 2. Yesterday: unmarked sessions, and present clients still without an evolution.
  const yesterdayRows = (yRes.data ?? []) as unknown as BookingRow[];
  const unmarked: Pending[] = yesterdayRows
    .filter((b) => b.status === null)
    .map((b) => ({ bookingId: b.id, clientId: b.client_id, name: nameOf(b), when: `${formatShort(b.date)}, ${hhmm(b.start_time)}` }));

  const presentIds = yesterdayRows.filter((b) => isPresent(b.status)).map((b) => b.id);
  let missingEvolution: Pending[] = [];
  if (presentIds.length > 0) {
    const evo = await supabase.from("evolutions").select("booking_id").in("booking_id", presentIds);
    fail("evoluções", evo.error);
    const done = new Set((evo.data ?? []).map((e) => e.booking_id as string));
    missingEvolution = yesterdayRows
      .filter((b) => isPresent(b.status) && !done.has(b.id))
      .map((b) => ({ bookingId: b.id, clientId: b.client_id, name: nameOf(b), when: `${formatShort(b.date)}, ${hhmm(b.start_time)} · sem evolução` }));
  }

  // 3. Justified misses in the last 7 days that nobody has made up yet.
  const missRows = (missRes.data ?? []) as unknown as BookingRow[];
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
  for (const b of (unjRes.data ?? []) as unknown as BookingRow[]) {
    const entry = missCount.get(b.client_id) ?? { name: nameOf(b), n: 0 };
    entry.n += 1;
    missCount.set(b.client_id, entry);
  }
  const attention: Attention[] = [];
  for (const [clientId, { name, n }] of missCount) {
    if (n >= 2) attention.push({ clientId, name, reason: `${n} faltas não justificadas neste mês` });
  }
  const booked = new Set((upcomingRes.data ?? []).map((r) => r.client_id as string));
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
    const rows = ((attRes.data ?? []) as { date: string; status: AttendanceStatus }[]).filter((r) => r.date >= from && r.date <= to);
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
    attendance: { rate: thisWeek, deltaPoints: thisWeek !== null && lastWeek !== null ? thisWeek - lastWeek : null },
  };
}
