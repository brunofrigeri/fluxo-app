import { statusLabels, unmarkedLabel, type DemoStatus } from "@fluxo/copy";

export const statusClass: Record<DemoStatus, string> = { ok: "st-ok", jm: "st-jm", um: "st-um", rp: "st-rp", no: "st-no" };
export const statusLabel: Record<DemoStatus, string> = {
  ok: statusLabels.PRESENCE_CONFIRMED,
  jm: statusLabels.JUSTIFIED_MISS,
  um: statusLabels.UNJUSTIFIED_MISS,
  rp: statusLabels.REPLACEMENT,
  no: unmarkedLabel,
};

/** The colored dot with its own icon: status is never told by color alone. */
export function StatusDot({ status }: { status: DemoStatus }) {
  return <span className={`sdot sd-${status}`} aria-hidden="true" />;
}

export function StatusPill({ status, label }: { status: DemoStatus; label?: string }) {
  return (
    <span className={`st ${statusClass[status]}`}>
      <StatusDot status={status} />
      {label ?? statusLabel[status]}
    </span>
  );
}
