"use client";

import { useEffect, useRef, useState } from "react";
import { statusMeta, type AttendanceStatus } from "@/lib/status";
import { StatusSelector } from "./StatusSelector";

/** The status chip from the design. Click it to open the statuses and mark attendance. Optimistic. */
export function StatusMenu({ bookingId, status: serverStatus, missReason }: { bookingId: string; status: AttendanceStatus | null; missReason?: string | null }) {
  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState(serverStatus);
  const [reason, setReason] = useState(missReason ?? null);
  const [error, setError] = useState<string | null>(null);
  const ref = useRef<HTMLDivElement>(null);
  const meta = statusMeta(status);

  // The server's answer wins once the page refreshes.
  useEffect(() => {
    setStatus(serverStatus);
    setReason(missReason ?? null);
  }, [serverStatus, missReason]);

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div className="stmenu" ref={ref}>
      <button type="button" className={`st hit ${meta.cls}`} aria-haspopup="true" aria-expanded={open} onClick={() => setOpen((v) => !v)}>
        <span className={`sdot ${meta.dot}`} />
        {meta.label}
      </button>
      {error && <div className="errmsg" role="alert" style={{ marginTop: 6 }}>{error}</div>}
      {open && (
        <div className="pop stmenu-pop">
          <StatusSelector
            bookingId={bookingId}
            status={status}
            missReason={reason}
            onDone={() => setOpen(false)}
            onOptimistic={(next, why) => {
              setError(null);
              setStatus(next);
              setReason(why);
            }}
            onFail={(previous, message) => {
              setStatus(previous);
              setError(message);
            }}
          />
        </div>
      )}
    </div>
  );
}
