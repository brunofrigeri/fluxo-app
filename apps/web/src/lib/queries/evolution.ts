import { getStudioModalities, type Modality } from "@/lib/modalities";
import { createClient } from "@/lib/supabase/server";
import type { SessionOption } from "@/components/EvolutionForm";
import { addDays, formatWeekdayDate, hhmm, todayISO } from "@fluxo/domain";
import { statusMeta, type AttendanceStatus } from "@/lib/status";

export type ClientHead = { id: string; name: string; routine: string };

const WEEKDAY_SHORT = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

export async function getClientHead(clientId: string): Promise<ClientHead | null> {
  const supabase = await createClient();
  const [c, s] = await Promise.all([
    supabase.from("clients").select("id, name").eq("id", clientId).maybeSingle(),
    supabase.from("recurring_slots").select("weekday, start_time").eq("client_id", clientId).order("weekday").order("start_time"),
  ]);
  if (!c.data) return null;
  const routine = (s.data ?? []).map((r) => `${WEEKDAY_SHORT[r.weekday as number]} ${hhmm(r.start_time as string)}`).join(", ");
  return { id: c.data.id as string, name: c.data.name as string, routine };
}

/** Sessions of this modality where the client was present (or made a replacement) that have no evolution yet. */
export async function getSessionOptions(clientId: string, modalityId: string, keepBookingId?: string | null): Promise<SessionOption[]> {
  const supabase = await createClient();
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
      label: `${formatWeekdayDate(r.date as string)}, ${hhmm(r.start_time as string)} · ${statusMeta(r.status as AttendanceStatus).label}`,
    }));
}

/** The modalities a client is enrolled in that the signed-in user can see (RLS: an instructor sees only their own). */
export async function getClientModalities(clientId: string): Promise<Modality[]> {
  const supabase = await createClient();
  const [studio, rows] = await Promise.all([getStudioModalities(), supabase.from("client_modality_instructors").select("modality_id").eq("client_id", clientId)]);
  if (rows.error) throw new Error(`modalidades do cliente: ${rows.error.message}`);
  const ids = new Set((rows.data ?? []).map((r) => r.modality_id as string));
  return studio.filter((m) => ids.has(m.id));
}

/** How many evolutions the client already has in a modality: the next session number is this plus one. */
export async function countEvolutions(clientId: string, modalityId: string): Promise<number> {
  const supabase = await createClient();
  const { count, error } = await supabase.from("evolutions").select("id", { count: "exact", head: true }).eq("client_id", clientId).eq("modality_id", modalityId);
  if (error) throw new Error(`evoluções: ${error.message}`);
  return count ?? 0;
}
