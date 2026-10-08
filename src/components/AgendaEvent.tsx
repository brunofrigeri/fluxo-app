"use client";

import Link from "next/link";
import { useEffect, useRef, useState, useTransition } from "react";
import { deleteBooking, getLastEvolution, getSessionNote, saveSessionNote } from "@/app/(app)/actions";
import type { AgendaBooking } from "@/lib/queries/agenda";
import { formatDayMonth, formatWeekdayDate } from "@/lib/dates";
import { isPresent, statusMeta } from "@/lib/status";
import { initialsOf } from "@/lib/age";
import { Icon } from "./Icon";
import { StatusSelector } from "./StatusSelector";

type Last = { date: string; title: string; text: string } | null | undefined;

function ClassPanel({ bookings, onClose }: { bookings: AgendaBooking[]; onClose: () => void }) {
  const first = bookings[0];
  const [note, setNote] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [editing, setEditing] = useState(false);
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    getSessionNote(first.date, first.hour).then((n) => {
      if (!alive) return;
      setNote(n ?? "");
      setDraft(n ?? "");
    });
    return () => {
      alive = false;
    };
  }, [first.date, first.hour]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  function saveNote() {
    setError(null);
    start(async () => {
      const r = await saveSessionNote(first.date, first.hour, draft);
      if (r.error) setError(r.error);
      else {
        setNote(draft.trim());
        setEditing(false);
      }
    });
  }

  return (
    <div className="scrim modal-scrim" onMouseDown={(e) => e.target === e.currentTarget && onClose()} onClick={(e) => e.stopPropagation()}>
      <div className="pop modal-box" role="dialog" aria-modal="true" aria-label={`Turma de ${formatWeekdayDate(first.date)}, ${first.time}`} style={{ width: 460 }}>
        <div className="row" style={{ alignItems: "flex-start" }}>
          <div className="grow">
            <h2 className="t-h2">{formatWeekdayDate(first.date)}</h2>
            <p className="t-small muted">{first.time} · {bookings.length === 1 ? "1 cliente" : `${bookings.length} clientes`}</p>
          </div>
          <button type="button" className="ibtn" aria-label="Fechar" onClick={onClose} style={{ margin: "-8px -8px 0 0" }}>
            <Icon name="x" />
          </button>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {bookings.map((b) => {
            const meta = statusMeta(b.status);
            return (
              <Link key={b.id} href={`/clientes/${b.clientId}`} className="row card flat" style={{ padding: "10px 12px", borderRadius: 12, textDecoration: "none", color: "var(--ink)" }}>
                <span className="avatar sm">{initialsOf(b.name)}</span>
                <span className="grow" style={{ fontWeight: 600 }}>{b.name}</span>
                {b.replacesDate && <span className="t-small" style={{ color: "var(--rp-fg)" }}>Repõe {formatDayMonth(b.replacesDate)}</span>}
                <span className={`st ${meta.cls}`}>
                  <span className={`sdot ${meta.dot}`} />
                  {meta.label}
                </span>
              </Link>
            );
          })}
        </div>

        <div className="field">
          <div className="row" style={{ justifyContent: "space-between" }}>
            <label className="label" htmlFor="class-note">Notas da turma</label>
            {!editing && note !== null && (
              <button type="button" className="btn quiet sm" onClick={() => setEditing(true)}>{note ? "Editar" : "Adicionar"}</button>
            )}
          </div>
          {note === null ? (
            <div className="skel" style={{ height: 60 }} />
          ) : editing ? (
            <>
              <textarea
                id="class-note"
                className="input"
                rows={3}
                maxLength={2000}
                autoFocus
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                placeholder="Ex.: turma cheia, trocar colchonete, aquecer antes do reformer…"
              />
              <div className="row" style={{ gap: 8, justifyContent: "flex-end", marginTop: 8 }}>
                <button type="button" className="btn sm" onClick={() => { setDraft(note); setEditing(false); }}>Cancelar</button>
                <button type="button" className={`btn pri sm${pending ? " dis" : ""}`} onClick={saveNote} aria-disabled={pending}>
                  {pending && <span className="spin" />}
                  Salvar
                </button>
              </div>
            </>
          ) : note ? (
            <p className="t-small" style={{ color: "var(--ink)" }}>{note}</p>
          ) : (
            <p className="t-small muted">Sem notas ainda.</p>
          )}
          {error && <div className="errmsg" role="alert">{error}</div>}
        </div>
      </div>
    </div>
  );
}

function Popover({ booking, pos, onClose }: { booking: AgendaBooking; pos: { left: number; top: number }; onClose: () => void }) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [last, setLast] = useState<Last>(undefined);

  useEffect(() => {
    let alive = true;
    getLastEvolution(booking.clientId).then((r) => alive && setLast(r));
    return () => {
      alive = false;
    };
  }, [booking.clientId]);

  function remove() {
    if (!window.confirm(`Remover ${booking.name} deste horário?`)) return;
    start(async () => {
      const r = await deleteBooking(booking.id);
      if (r.error) setError(r.error);
      else onClose();
    });
  }

  return (
    <div
      className="pop bk-pop"
      role="dialog"
      aria-label={`${booking.name}, ${formatWeekdayDate(booking.date)}, ${booking.time}`}
      style={{ left: pos.left, top: pos.top }}
      data-bk-pop
      onClick={(e) => e.stopPropagation()}
    >
      <div className="row" style={{ alignItems: "flex-start" }}>
        <span className="avatar">{initialsOf(booking.name)}</span>
        <div className="grow" style={{ lineHeight: 1.35 }}>
          <div className="t-h3">{booking.name}</div>
          <div className="t-small muted">
            {formatWeekdayDate(booking.date)}, {booking.time}
          </div>
          {booking.replacesDate && (
            <div className="t-small" style={{ color: "var(--rp-fg)", fontWeight: 600 }}>
              Reposição de {formatDayMonth(booking.replacesDate)}
            </div>
          )}
        </div>
        <button type="button" className="ibtn" aria-label="Fechar" onClick={onClose} style={{ margin: "-6px -6px 0 0" }}>
          <Icon name="x" />
        </button>
      </div>

      <StatusSelector bookingId={booking.id} status={booking.status} missReason={booking.missReason} />

      <div className="card stone" style={{ padding: "14px 16px", borderRadius: 12 }}>
        <div className="t-tiny faint" style={{ marginBottom: 4 }}>
          {last ? `Última evolução · ${last.date}` : "Última evolução"}
        </div>
        {last === undefined ? (
          <div className="skel" style={{ height: 18 }} />
        ) : last === null ? (
          <p className="t-small muted">Sem evolução ainda</p>
        ) : (
          <p className="t-small" style={{ color: "var(--ink)" }}>
            {last.text || last.title}
          </p>
        )}
      </div>

      {error && (
        <div className="errmsg" role="alert">
          {error}
        </div>
      )}

      <div className="row" style={{ gap: 8 }}>
        <Link className="btn" href={`/clientes/${booking.clientId}`} style={{ flex: 1 }}>
          Ver detalhes
        </Link>
        {isPresent(booking.status) && (
          <Link className="btn pri" href={`/clientes/${booking.clientId}/evolucoes/nova?sessao=${booking.id}`} style={{ flex: 1.2 }}>
            <Icon name="note" size={16} />
            Escrever evolução
          </Link>
        )}
      </div>
      <button type="button" className="btn quiet sm" style={{ alignSelf: "flex-start", color: "var(--ink-2)" }} onClick={remove} disabled={pending}>
        Remover deste horário
      </button>
    </div>
  );
}

export function AgendaEvent({ bookings, compact, onAdd, row }: { bookings: AgendaBooking[]; compact: boolean; onAdd: () => void; row: number }) {
  const [openId, setOpenId] = useState<string | null>(null);
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null);
  const [panelOpen, setPanelOpen] = useState(false);
  const wrap = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!openId) return;
    const onDown = (e: MouseEvent) => {
      const t = e.target as HTMLElement;
      if (t.closest("[data-bk-pop]") || t.closest("[data-bk-chip]")) return;
      setOpenId(null);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpenId(null);
    const onMove = () => setOpenId(null);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    window.addEventListener("scroll", onMove, true);
    window.addEventListener("resize", onMove);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("scroll", onMove, true);
      window.removeEventListener("resize", onMove);
    };
  }, [openId]);

  function open(id: string, el: HTMLElement) {
    if (openId === id) return setOpenId(null);
    const r = el.getBoundingClientRect();
    const width = Math.min(384, window.innerWidth - 24);
    const left = Math.min(Math.max(12, r.left), window.innerWidth - width - 12);
    const height = 400;
    const top = r.bottom + 8 + height > window.innerHeight ? Math.max(12, r.top - height - 8) : r.bottom + 8;
    setPos({ left, top });
    setOpenId(id);
  }

  const active = bookings.find((b) => b.id === openId);

  return (
    <div
      className={`ev agenda gr${row}`}
      ref={wrap}
      role="button"
      tabIndex={0}
      aria-haspopup="dialog"
      aria-label={`Ver turma, ${bookings.length === 1 ? "1 cliente" : `${bookings.length} clientes`}`}
      onClick={() => setPanelOpen(true)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          setPanelOpen(true);
        }
      }}
    >
      <div className="top">
        <span className="occ">{bookings.length === 1 ? "1 cliente" : `${bookings.length} clientes`}</span>
        <button type="button" onClick={(e) => { e.stopPropagation(); onAdd(); }} className="addmini" aria-label="Adicionar cliente neste horário" title="Adicionar cliente neste horário">
          <Icon name="plus" size={14} />
        </button>
      </div>
      <div className="chips">
        {bookings.map((b) => {
          const meta = statusMeta(b.status);
          const missed = b.status === "JUSTIFIED_MISS" || b.status === "UNJUSTIFIED_MISS";
          return (
            <button
              key={b.id}
              type="button"
              data-bk-chip
              className={`cchip${missed ? " miss" : ""}${openId === b.id ? " sel" : ""}`}
              aria-haspopup="dialog"
              aria-expanded={openId === b.id}
              onClick={(e) => { e.stopPropagation(); open(b.id, e.currentTarget); }}
              title={`${b.name} · ${meta.label}${b.missReason ? ` (${b.missReason})` : ""}`}
            >
              <span className={`sdot ${meta.dot}`} />
              <span className="cname">{compact ? b.name.split(" ")[0] : b.name}</span>
            </button>
          );
        })}
      </div>
      {active && pos && <Popover booking={active} pos={pos} onClose={() => setOpenId(null)} />}
      {panelOpen && <ClassPanel bookings={bookings} onClose={() => setPanelOpen(false)} />}
    </div>
  );
}
