"use client";

import { useState, useTransition } from "react";
import { setBookingStatus } from "@/app/(app)/actions";
import { STATUS_META, STATUS_VALUES, type AttendanceStatus } from "@/lib/status";

/**
 * The four statuses of a booking. Choosing "Falta justificada" asks for the reason first.
 * A replacement is created by scheduling one (it points to the missed session), so it cannot be picked here,
 * and a booking that is a replacement keeps that status.
 */
export function StatusSelector({
  bookingId, status: initialStatus, missReason, onDone, onOptimistic, onFail,
}: {
  bookingId: string;
  status: AttendanceStatus | null;
  missReason: string | null;
  /** Called at once after a choice, so the menu around it can close without waiting for the server. */
  onDone?: () => void;
  /** The new status, applied by the caller immediately. */
  onOptimistic?: (next: AttendanceStatus | null, reason: string | null) => void;
  /** The server refused: the caller puts the previous status back. */
  onFail?: (previous: AttendanceStatus | null, message: string) => void;
}) {
  const [, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [asking, setAsking] = useState(false);
  const [reason, setReason] = useState(missReason ?? "");
  const [status, setStatus] = useState(initialStatus);
  const pending = false; // choices are optimistic: nothing waits on the server
  const isReplacement = status === "REPLACEMENT";

  // Optimistic: show and close at once, save in the background, put it back if the server says no.
  function save(next: AttendanceStatus | null, why?: string) {
    const previous = status;
    setError(null);
    setStatus(next);
    setAsking(false);
    onOptimistic?.(next, next === "JUSTIFIED_MISS" ? (why ?? null) : null);
    onDone?.();
    start(async () => {
      const r = await setBookingStatus(bookingId, next, why);
      if (!r.error) return;
      setStatus(previous);
      setError(r.error);
      onFail?.(previous, r.error);
    });
  }

  function pick(value: AttendanceStatus) {
    if (value === "JUSTIFIED_MISS") return setAsking(true); // also when already selected: edit the reason
    if (value !== status) save(value);
  }

  const reasonOk = reason.trim().length > 0;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <div className="stsel">
        {STATUS_VALUES.map((value) => {
          const m = STATUS_META[value];
          const selected = status === value;
          const locked = value === "REPLACEMENT" ? !selected : isReplacement;
          return (
            <button
              key={value}
              type="button"
              className={`st ${m.cls}${selected ? " sel" : ""}`}
              aria-pressed={selected}
              disabled={pending || locked}
              title={locked ? (isReplacement ? "Esta sessão é uma reposição" : "Use “É reposição?” ao adicionar o cliente a um horário") : undefined}
              onClick={() => pick(value)}
            >
              <span className={`sdot ${m.dot}`} />
              <span className="stlabel">{m.label}</span>
            </button>
          );
        })}
      </div>

      {status === "JUSTIFIED_MISS" && missReason && !asking && (
        <p className="t-small muted">
          <b style={{ color: "var(--ink)" }}>Motivo:</b> {missReason}
        </p>
      )}

      {asking && (
        <form
          className="field"
          onSubmit={(e) => {
            e.preventDefault();
            if (reasonOk && !pending) save("JUSTIFIED_MISS", reason.trim());
          }}
        >
          <label className="label" htmlFor={`reason-${bookingId}`}>Motivo da falta</label>
          <input
            id={`reason-${bookingId}`}
            className="input"
            value={reason}
            maxLength={300}
            autoFocus
            autoComplete="off"
            placeholder="Ex.: gripe, viagem, compromisso de trabalho"
            onChange={(e) => setReason(e.target.value)}
          />
          <div className="row" style={{ gap: 8, justifyContent: "flex-end", marginTop: 4 }}>
            <button type="button" className="btn sm" onClick={() => setAsking(false)}>Cancelar</button>
            <button type="submit" className={`btn pri sm${reasonOk && !pending ? "" : " dis"}`} aria-disabled={!reasonOk || pending}>
              {pending && <span className="spin" />}
              Confirmar
            </button>
          </div>
        </form>
      )}

      {status && !isReplacement && !asking && (
        <button type="button" className="btn quiet sm" style={{ alignSelf: "flex-start" }} onClick={() => save(null)} disabled={pending}>
          Limpar status
        </button>
      )}

      {error && (
        <div className="errmsg" role="alert">
          {error}
        </div>
      )}
    </div>
  );
}
