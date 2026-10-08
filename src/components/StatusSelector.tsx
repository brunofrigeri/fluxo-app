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
  bookingId, status, missReason, onDone,
}: {
  bookingId: string;
  status: AttendanceStatus | null;
  missReason: string | null;
  onDone?: () => void;
}) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [asking, setAsking] = useState(false);
  const [reason, setReason] = useState(missReason ?? "");
  const isReplacement = status === "REPLACEMENT";

  function save(next: AttendanceStatus | null, why?: string) {
    setError(null);
    start(async () => {
      const r = await setBookingStatus(bookingId, next, why);
      if (r.error) setError(r.error);
      else {
        setAsking(false);
        onDone?.();
      }
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
