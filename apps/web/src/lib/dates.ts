// All dates in Fluxo are plain calendar dates ("YYYY-MM-DD") in the studio's time zone.
export const TZ = "America/Sao_Paulo";

const WEEKDAY_SHORT = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
const WEEKDAY_NAME = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];

export function todayISO(now: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: TZ }).format(now);
}

export function hourNow(now: Date = new Date()): number {
  return Number(
    new Intl.DateTimeFormat("en-GB", { timeZone: TZ, hour: "2-digit", hour12: false }).format(now),
  );
}

/** Minutes since midnight, in the studio's time zone. */
export function minuteOfDayNow(now: Date = new Date()): number {
  const parts = new Intl.DateTimeFormat("en-GB", { timeZone: TZ, hour: "2-digit", minute: "2-digit", hour12: false }).formatToParts(now);
  const h = Number(parts.find((p) => p.type === "hour")?.value ?? 0) % 24;
  const m = Number(parts.find((p) => p.type === "minute")?.value ?? 0);
  return h * 60 + m;
}

export function addDays(iso: string, days: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
}

export function weekdayOf(iso: string): number {
  return new Date(`${iso}T00:00:00Z`).getUTCDay();
}

/** 05/10/2026 */
export function formatBR(iso: string): string {
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

/** 05/10 */
export function formatDayMonth(iso: string): string {
  const [, m, d] = iso.split("-");
  return `${d}/${m}`;
}

/** Seg 05/10 */
export function formatShort(iso: string): string {
  return `${WEEKDAY_SHORT[weekdayOf(iso)]} ${formatDayMonth(iso)}`;
}

/** Segunda, 05/10 */
export function formatWeekdayDate(iso: string): string {
  return `${WEEKDAY_NAME[weekdayOf(iso)]}, ${formatDayMonth(iso)}`;
}

/** Segunda-feira, 05/10/2026 */
export function formatLong(iso: string): string {
  const name = WEEKDAY_NAME[weekdayOf(iso)];
  const suffix = weekdayOf(iso) === 0 || weekdayOf(iso) === 6 ? "" : "-feira";
  return `${name}${suffix}, ${formatBR(iso)}`;
}

/** "07:00:00" -> "07:00" */
export function hhmm(time: string): string {
  return time.slice(0, 5);
}

const MONTH_NAME = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];

export function monthName(iso: string): string {
  return MONTH_NAME[Number(iso.slice(5, 7)) - 1];
}

export function monthShort(iso: string): string {
  return monthName(iso).slice(0, 3);
}

/** Outubro de 2026 */
export function formatMonthYear(iso: string): string {
  const m = monthName(iso);
  return `${m[0].toUpperCase()}${m.slice(1)} de ${iso.slice(0, 4)}`;
}

export function addMonths(iso: string, months: number): string {
  const [y, m] = iso.split("-").map(Number);
  const total = y * 12 + (m - 1) + months;
  const ny = Math.floor(total / 12);
  const nm = (total % 12) + 1;
  return `${ny}-${String(nm).padStart(2, "0")}-01`;
}

/** The Monday on or before the date. */
export function mondayOf(iso: string): string {
  return addDays(iso, -((weekdayOf(iso) + 6) % 7));
}

export function isValidISO(value: string | undefined): value is string {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  return !Number.isNaN(Date.parse(`${value}T00:00:00Z`)) && new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) === value;
}

export function weekdayShortUpper(iso: string): string {
  return WEEKDAY_SHORT[weekdayOf(iso)].toUpperCase();
}

export function dayNumber(iso: string): string {
  return iso.slice(8, 10);
}

export function weekdayName(index: number): string {
  return WEEKDAY_NAME[index];
}

export function greeting(now: Date = new Date()): string {
  const h = hourNow(now);
  if (h < 12) return "Bom dia";
  if (h < 18) return "Boa tarde";
  return "Boa noite";
}
