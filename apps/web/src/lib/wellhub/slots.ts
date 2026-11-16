import { TZ } from "@fluxo/domain";

// Builds the slot Wellhub should list for one class time on one date. Pure: no network, no database.

export type BookingRules = { opensDaysBefore: number; closesHoursBefore: number; cancelHoursBefore: number };

export type ClassSlotInput = {
  startTime: string; // "HH:MM" or "HH:MM:SS"
  durationMinutes: number;
  capacity: number;
};

export type WellhubSlotPayload = {
  occur_date: string;
  length_in_minutes: number;
  total_capacity: number;
  total_booked: number;
  product_id: number;
  status: 1;
  booking_window: { opens_at: string; closes_at: string };
  cancellable_until: string;
  room?: string;
  instructors?: { name: string; substitute: boolean }[];
};

/** Wellhub caps the free-cancellation notice at 24 hours. */
export const MAX_CANCEL_HOURS = 24;

const HOUR = 3_600_000;

function offsetMinutes(at: Date): number {
  const name = new Intl.DateTimeFormat("en-US", { timeZone: TZ, timeZoneName: "longOffset" })
    .formatToParts(at)
    .find((p) => p.type === "timeZoneName")?.value ?? "GMT";
  const m = /GMT([+-])(\d{2}):(\d{2})/.exec(name);
  if (!m) return 0;
  return (m[1] === "-" ? -1 : 1) * (Number(m[2]) * 60 + Number(m[3]));
}

function offsetLabel(minutes: number): string {
  const sign = minutes < 0 ? "-" : "+";
  const abs = Math.abs(minutes);
  return `${sign}${String(Math.floor(abs / 60)).padStart(2, "0")}:${String(abs % 60).padStart(2, "0")}`;
}

/** The instant of a studio wall-clock time ("2026-03-02", "07:00"). */
export function instantOf(date: string, time: string): Date {
  const hhmm = time.slice(0, 5);
  const guess = new Date(`${date}T${hhmm}:00Z`);
  const first = new Date(guess.getTime() - offsetMinutes(guess) * 60_000);
  return new Date(guess.getTime() - offsetMinutes(first) * 60_000);
}

/** An instant as an ISO string in the studio's zone, with its offset: "2026-03-02T07:00:00-03:00". */
export function localISO(at: Date): string {
  const p = Object.fromEntries(
    new Intl.DateTimeFormat("en-CA", {
      timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit",
      hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23",
    }).formatToParts(at).map((x) => [x.type, x.value]),
  );
  return `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}:${p.second}${offsetLabel(offsetMinutes(at))}`;
}

export type BuildSlotInput = {
  slot: ClassSlotInput;
  date: string;
  /** People already in this session, however they booked. */
  occupancy: number;
  rules: BookingRules;
  productId: number;
  now?: Date;
  room?: string;
  instructorName?: string;
};

/**
 * The slot to publish, or null when it must not be listed (already started: Wellhub only accepts
 * future times). `total_booked` is clamped to the capacity because Wellhub rejects more booked than
 * capacity, and the studio may have overbooked by hand; the clamp makes such a class read as full.
 */
export function buildSlot(i: BuildSlotInput): WellhubSlotPayload | null {
  const now = i.now ?? new Date();
  const occur = instantOf(i.date, i.slot.startTime);
  if (occur.getTime() <= now.getTime()) return null;

  const cancelHours = Math.min(i.rules.cancelHoursBefore, MAX_CANCEL_HOURS);
  const closes = new Date(occur.getTime() - i.rules.closesHoursBefore * HOUR);
  const opens = new Date(occur.getTime() - i.rules.opensDaysBefore * 24 * HOUR);

  return {
    occur_date: localISO(occur),
    length_in_minutes: i.slot.durationMinutes,
    total_capacity: i.slot.capacity,
    total_booked: Math.min(Math.max(i.occupancy, 0), i.slot.capacity),
    product_id: i.productId,
    status: 1,
    booking_window: { opens_at: localISO(opens), closes_at: localISO(closes) },
    cancellable_until: localISO(new Date(occur.getTime() - cancelHours * HOUR)),
    ...(i.room ? { room: i.room } : {}),
    ...(i.instructorName ? { instructors: [{ name: i.instructorName, substitute: false }] } : {}),
  };
}
