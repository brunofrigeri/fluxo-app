import { statusLabels, unmarkedLabel } from "@fluxo/copy";
import { STATUS_VALUES, type AttendanceStatus } from "@fluxo/domain";

// Rules live in @fluxo/domain and wording in @fluxo/copy. This file only adds the web's CSS class names.
export { STATUS_VALUES, isPresent, isStatus, type AttendanceStatus } from "@fluxo/domain";

type StatusMeta = { label: string; cls: string; dot: string };

// cls / dot are class names from the design system (src/styles/fluxo.css).
const CLASSES: Record<AttendanceStatus, { cls: string; dot: string }> = {
  PRESENCE_CONFIRMED: { cls: "st-ok", dot: "sd-ok" },
  JUSTIFIED_MISS: { cls: "st-jm", dot: "sd-jm" },
  UNJUSTIFIED_MISS: { cls: "st-um", dot: "sd-um" },
  REPLACEMENT: { cls: "st-rp", dot: "sd-rp" },
};

export const STATUS_META = Object.fromEntries(
  STATUS_VALUES.map((s) => [s, { label: statusLabels[s], ...CLASSES[s] }]),
) as Record<AttendanceStatus, StatusMeta>;

export const UNMARKED: StatusMeta = { label: unmarkedLabel, cls: "st-no", dot: "sd-no" };

export function statusMeta(status: AttendanceStatus | null): StatusMeta {
  return status ? STATUS_META[status] : UNMARKED;
}
