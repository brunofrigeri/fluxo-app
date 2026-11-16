export const STATUS_VALUES = [
  "PRESENCE_CONFIRMED",
  "JUSTIFIED_MISS",
  "UNJUSTIFIED_MISS",
  "REPLACEMENT",
] as const;

export type AttendanceStatus = (typeof STATUS_VALUES)[number];

type StatusMeta = { label: string; cls: string; dot: string };

// cls / dot are class names from the design system (src/styles/fluxo.css).
export const STATUS_META: Record<AttendanceStatus, StatusMeta> = {
  PRESENCE_CONFIRMED: { label: "Presença confirmada", cls: "st-ok", dot: "sd-ok" },
  JUSTIFIED_MISS: { label: "Falta justificada", cls: "st-jm", dot: "sd-jm" },
  UNJUSTIFIED_MISS: { label: "Falta não justificada", cls: "st-um", dot: "sd-um" },
  REPLACEMENT: { label: "Reposição", cls: "st-rp", dot: "sd-rp" },
};

export const UNMARKED: StatusMeta = { label: "Não marcado", cls: "st-no", dot: "sd-no" };

export function statusMeta(status: AttendanceStatus | null): StatusMeta {
  return status ? STATUS_META[status] : UNMARKED;
}

export function isPresent(status: AttendanceStatus | null): boolean {
  return status === "PRESENCE_CONFIRMED" || status === "REPLACEMENT";
}

export function isStatus(value: unknown): value is AttendanceStatus {
  return typeof value === "string" && (STATUS_VALUES as readonly string[]).includes(value);
}
