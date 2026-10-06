import { createClient } from "@/lib/supabase/server";
import { addDays, addMonths, dayNumber, formatBR, formatDayMonth, formatLong, formatMonthYear, hhmm, isValidISO, mondayOf, monthName, monthShort, todayISO } from "@/lib/dates";
import { FIRST_HOUR, LAST_HOUR } from "@/lib/agenda-config";
import type { AttendanceStatus } from "@/lib/status";

export const VIEWS = ["dia", "3dias", "semana", "mes"] as const;
export type View = (typeof VIEWS)[number];

export { FIRST_HOUR, LAST_HOUR };

export type AgendaBooking = {
  id: string;
  clientId: string;
  name: string;
  status: AttendanceStatus | null;
  date: string;
  hour: number;
  time: string;
  replacesDate: string | null;
  missReason: string | null;
};

export type AgendaRange = {
  view: View;
  anchor: string;
  days: string[];
  from: string;
  to: string;
  title: string;
  prev: string;
  next: string;
};

export function parseView(value: string | undefined, fallback: View): View {
  return (VIEWS as readonly string[]).includes(value ?? "") ? (value as View) : fallback;
}

export function rangeFor(view: View, rawDate: string | undefined): AgendaRange {
  const today = todayISO();
  const anchor = isValidISO(rawDate) ? rawDate : today;

  if (view === "mes") {
    const first = `${anchor.slice(0, 8)}01`;
    const start = mondayOf(first);
    const nextFirst = addMonths(first, 1);
    const lastDay = addDays(nextFirst, -1);
    const end = addDays(mondayOf(lastDay), 6);
    const days: string[] = [];
    for (let d = start; d <= end; d = addDays(d, 1)) days.push(d);
    return { view, anchor: first, days, from: start, to: end, title: formatMonthYear(first), prev: addMonths(first, -1), next: nextFirst };
  }

  const start = view === "semana" ? mondayOf(anchor) : anchor;
  const count = view === "dia" ? 1 : view === "3dias" ? 3 : 7;
  const days = Array.from({ length: count }, (_, i) => addDays(start, i));
  const step = view === "dia" ? 1 : count;
  const last = days[days.length - 1];

  let title: string;
  if (view === "dia") title = formatLong(start);
  else if (start.slice(0, 7) === last.slice(0, 7)) title = `${dayNumber(start)} – ${dayNumber(last)} de ${monthName(last)}`;
  else title = `${dayNumber(start)} de ${monthShort(start)} – ${dayNumber(last)} de ${monthShort(last)}`;

  return { view, anchor: start, days, from: start, to: last, title, prev: addDays(start, -step), next: addDays(start, step) };
}

type Row = {
  id: string;
  client_id: string;
  date: string;
  start_time: string;
  status: AttendanceStatus | null;
  replaces_booking_id: string | null;
  miss_reason: string | null;
  clients: { name: string } | { name: string }[] | null;
};

export async function getAgendaBookings(from: string, to: string): Promise<AgendaBooking[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("bookings")
    .select("id, client_id, date, start_time, status, replaces_booking_id, miss_reason, clients(name)")
    .gte("date", from)
    .lte("date", to)
    .order("start_time")
    .order("date");
  if (error) throw new Error(`agenda: ${error.message}`);
  const rows = (data ?? []) as unknown as Row[];

  // For replacements, find the date of the session being made up.
  const replacedIds = rows.map((r) => r.replaces_booking_id).filter((v): v is string => Boolean(v));
  const replacedDates = new Map<string, string>();
  if (replacedIds.length > 0) {
    const res = await supabase.from("bookings").select("id, date").in("id", replacedIds);
    for (const r of res.data ?? []) replacedDates.set(r.id as string, r.date as string);
  }

  return rows.map((r) => {
    const client = Array.isArray(r.clients) ? r.clients[0] : r.clients;
    return {
      id: r.id,
      clientId: r.client_id,
      name: client?.name ?? "Cliente",
      status: r.status,
      date: r.date,
      hour: Number(r.start_time.slice(0, 2)),
      time: hhmm(r.start_time),
      replacesDate: r.replaces_booking_id ? (replacedDates.get(r.replaces_booking_id) ?? null) : null,
      missReason: r.miss_reason,
    };
  });
}

export type DialogClient = { id: string; name: string; misses: { id: string; label: string; reason: string | null }[] };

/** Active clients, each with the justified misses nobody has made up yet. */
export async function getDialogClients(): Promise<DialogClient[]> {
  const supabase = await createClient();
  const today = todayISO();
  const since = addDays(today, -90);
  const [clientsRes, missRes] = await Promise.all([
    supabase.from("clients").select("id, name").eq("active", true).order("name"),
    supabase.from("bookings").select("id, client_id, date, start_time, miss_reason").eq("status", "JUSTIFIED_MISS").gte("date", since).order("date", { ascending: false }),
  ]);
  if (clientsRes.error) throw new Error(`clientes: ${clientsRes.error.message}`);

  const misses = missRes.data ?? [];
  let madeUp = new Set<string>();
  if (misses.length > 0) {
    const made = await supabase.from("bookings").select("replaces_booking_id").in("replaces_booking_id", misses.map((m) => m.id as string));
    madeUp = new Set((made.data ?? []).map((r) => r.replaces_booking_id as string));
  }
  const byClient = new Map<string, DialogClient["misses"]>();
  for (const m of misses) {
    if (madeUp.has(m.id as string)) continue;
    const list = byClient.get(m.client_id as string) ?? [];
    list.push({ id: m.id as string, label: `${formatBR(m.date as string)}, ${hhmm(m.start_time as string)}`, reason: (m.miss_reason as string | null) ?? null });
    byClient.set(m.client_id as string, list);
  }
  return (clientsRes.data ?? []).map((c) => ({ id: c.id as string, name: c.name as string, misses: byClient.get(c.id as string) ?? [] }));
}

export function monthCellLabel(count: number): string {
  if (count === 0) return "Sem sessões";
  return count === 1 ? "1 sessão" : `${count} sessões`;
}

export { formatDayMonth };
