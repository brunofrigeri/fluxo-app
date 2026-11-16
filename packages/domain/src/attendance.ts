export const STATUS_VALUES = [
  "PRESENCE_CONFIRMED",
  "JUSTIFIED_MISS",
  "UNJUSTIFIED_MISS",
  "REPLACEMENT",
] as const;

export type AttendanceStatus = (typeof STATUS_VALUES)[number];

/** Present, or made up a justified miss: both count as attended. */
export function isPresent(status: AttendanceStatus | null): boolean {
  return status === "PRESENCE_CONFIRMED" || status === "REPLACEMENT";
}

export function isStatus(value: unknown): value is AttendanceStatus {
  return typeof value === "string" && (STATUS_VALUES as readonly string[]).includes(value);
}
