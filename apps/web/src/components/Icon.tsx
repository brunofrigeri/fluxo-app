// Icons come from the design system: stroke masks generated from packages/tokens (tokens.css).
export type IconName =
  | "home" | "calendar" | "users" | "check" | "calx" | "x" | "repeat" | "chevl" | "chevr" | "chevd"
  | "plus" | "search" | "eye" | "eyeoff" | "edit" | "logout" | "cake" | "alert" | "clock" | "archive"
  | "phone" | "mail" | "lock" | "dots" | "down" | "up" | "note" | "wave" | "refresh" | "info" | "shield";

export function Icon({ name, size = 18, className = "" }: { name: IconName; size?: 14 | 16 | 18 | 20 | 24; className?: string }) {
  const s = size === 18 ? "" : ` s${size}`;
  return <span aria-hidden="true" className={`ic i-${name}${s} ${className}`.trim()} />;
}
