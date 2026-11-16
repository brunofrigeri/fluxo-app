import type { AttendanceStatus } from "@fluxo/domain";
import type { Theme } from "@fluxo/tokens";

type Tone = "ok" | "jm" | "um" | "rp";

const TONE: Record<AttendanceStatus, Tone> = {
  PRESENCE_CONFIRMED: "ok",
  JUSTIFIED_MISS: "jm",
  UNJUSTIFIED_MISS: "um",
  REPLACEMENT: "rp",
};

/** Chip colors for an attendance status, or the neutral "not marked" look. */
export function statusColors(theme: Theme, status: AttendanceStatus | null): { bg: string; fg: string; dot: string } {
  if (!status) return { bg: theme.stone, fg: theme.ink2, dot: theme.lineStrong };
  const t = TONE[status];
  return { bg: theme[`${t}Bg`], fg: theme[`${t}Fg`], dot: theme[`${t}Dot`] };
}
