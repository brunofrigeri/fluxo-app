import type { IconName } from "@fluxo/tokens";

export type { IconName };

// Icons are stroke masks generated from @fluxo/tokens (tokens.css defines .i-<name>).
export function Icon({ name, size = 18, className = "" }: { name: IconName; size?: 14 | 16 | 18 | 20 | 24; className?: string }) {
  const s = size === 18 ? "" : ` s${size}`;
  return <span aria-hidden="true" className={`ic i-${name}${s} ${className}`.trim()} />;
}
