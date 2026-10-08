"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { createBooking } from "@/app/(app)/actions";
import type { DialogClient } from "@/lib/queries/agenda";
import { initialsOf } from "@/lib/age";
import { FIRST_HOUR, LAST_HOUR } from "@/lib/agenda-config";
import { Icon } from "./Icon";

type Props = {
  onClose: () => void;
  onCreated: () => void;
  clients: DialogClient[] | null;
  initialDate: string;
  initialHour: number;
  initialClientId?: string;
  initialMissId?: string;
  slotCount?: number;
};

const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

export function AddBookingDialog({ onClose, onCreated, clients, initialDate, initialHour, initialClientId, initialMissId, slotCount }: Props) {
  const [pending, start] = useTransition();
  const [query, setQuery] = useState("");
  const [clientId, setClientId] = useState<string | null>(initialClientId ?? null);
  const [replacement, setReplacement] = useState(Boolean(initialMissId));
  const [missId, setMissId] = useState<string | null>(initialMissId ?? null);
  const [date, setDate] = useState(initialDate);
  const [hour, setHour] = useState(initialHour);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  const selected = (clients ?? []).find((c) => c.id === clientId) ?? null;
  const results = useMemo(() => {
    const q = norm(query.trim());
    if (!q || !clients) return [];
    return clients.filter((c) => norm(c.name).includes(q)).slice(0, 6);
  }, [clients, query]);

  const needsMiss = replacement && selected && selected.misses.length > 0;
  const canSubmit = Boolean(selected) && (!replacement || Boolean(missId));

  function submit() {
    if (!selected) return;
    setError(null);
    start(async () => {
      const r = await createBooking({ clientId: selected.id, date, hour, replacesId: replacement ? (missId ?? undefined) : undefined });
      if (r.error) setError(r.error);
      else onCreated();
    });
  }

  return (
    <div className="scrim modal-scrim" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="pop modal-box" role="dialog" aria-modal="true" aria-labelledby="add-title" style={{ width: 460 }}>
        <div className="row" style={{ alignItems: "flex-start" }}>
          <div className="grow">
            <h2 className="t-h2" id="add-title">{replacement ? "Agendar reposição" : "Adicionar cliente"}</h2>
            {slotCount !== undefined && <p className="t-small muted">{slotCount === 1 ? "1 cliente neste horário" : `${slotCount} clientes neste horário`}</p>}
          </div>
          <button className="ibtn" type="button" aria-label="Fechar" onClick={onClose} style={{ margin: "-8px -8px 0 0" }}>
            <Icon name="x" />
          </button>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) 120px", gap: 12 }}>
          <div className="field">
            <label className="label" htmlFor="b-date">Data</label>
            <input id="b-date" className="input" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
          <div className="field">
            <label className="label" htmlFor="b-hour">Horário</label>
            <select id="b-hour" className="input" value={hour} onChange={(e) => setHour(Number(e.target.value))}>
              {Array.from({ length: LAST_HOUR - FIRST_HOUR + 1 }, (_, i) => FIRST_HOUR + i).map((h) => (
                <option key={h} value={h}>{String(h).padStart(2, "0")}:00</option>
              ))}
            </select>
          </div>
        </div>

        <div className="field">
          <label className="label" htmlFor="b-client">Cliente</label>
          {selected ? (
            <div className="row card flat" style={{ padding: "8px 8px 8px 12px", borderRadius: 12 }}>
              <span className="avatar sm">{initialsOf(selected.name)}</span>
              <span className="grow" style={{ fontWeight: 600 }}>{selected.name}</span>
              <button type="button" className="btn quiet sm" onClick={() => { setClientId(null); setMissId(null); }}>Trocar</button>
            </div>
          ) : (
            <>
              <div className="inwrap">
                <span className="ic i-search lead" aria-hidden="true" />
                <input id="b-client" className="input with-ic" placeholder="Buscar cliente" value={query} onChange={(e) => setQuery(e.target.value)} autoFocus autoComplete="off" disabled={!clients} />
              </div>
              {!clients ? (
                <p className="help">Carregando clientes…</p>
              ) : query.trim() === "" ? (
                <p className="help">Digite para buscar. Clientes arquivados não aparecem.</p>
              ) : results.length === 0 ? (
                <p className="help">Nenhum cliente encontrado.</p>
              ) : (
                <div className="card flat" style={{ padding: 6, borderRadius: 12 }}>
                  {results.map((c) => (
                    <button key={c.id} type="button" className="nav-i" style={{ width: "100%", height: 48 }} onClick={() => { setClientId(c.id); setMissId(c.misses[0]?.id ?? null); }}>
                      <span className="avatar sm">{initialsOf(c.name)}</span>
                      {c.name}
                    </button>
                  ))}
                </div>
              )}
            </>
          )}
        </div>

        <div className="row" style={{ justifyContent: "space-between" }}>
          <label className="label" htmlFor="b-rep">É reposição?</label>
          <button id="b-rep" type="button" className={`toggle${replacement ? " on" : ""}`} role="switch" aria-checked={replacement} onClick={() => setReplacement((v) => !v)} />
        </div>

        {replacement && selected && (
          needsMiss ? (
            <fieldset style={{ border: 0, padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: 8 }}>
              <legend className="label" style={{ padding: 0, marginBottom: 8 }}>Qual falta justificada {selected.name.split(" ")[0]} repõe?</legend>
              {selected.misses.map((m) => (
                <label key={m.id} className="row card flat" style={{ padding: "12px 14px", borderRadius: 12, gap: 12, borderColor: missId === m.id ? "var(--accent)" : undefined }}>
                  <input type="radio" name="miss" checked={missId === m.id} onChange={() => setMissId(m.id)} style={{ accentColor: "var(--accent)", width: 18, height: 18 }} />
                  <span className="grow">
                    <span style={{ fontWeight: 600 }}>{m.label}</span>
                    {m.reason && <span className="t-small muted" style={{ display: "block" }}>Motivo: {m.reason}</span>}
                  </span>
                  <span className="st st-jm" style={{ height: 24 }}><span className="sdot sd-jm" style={{ width: 14, height: 14 }} />Justificada</span>
                </label>
              ))}
            </fieldset>
          ) : (
            <div className="errmsg" role="status" style={{ background: "var(--jm-bg)", color: "var(--jm-fg)" }}>
              <Icon name="info" size={16} />
              {selected.name.split(" ")[0]} não tem falta justificada pendente de reposição.
            </div>
          )
        )}

        {error && <div className="errmsg" role="alert">{error}</div>}

        <div className="row" style={{ justifyContent: "flex-end", gap: 10 }}>
          <button className="btn" type="button" onClick={onClose}>Cancelar</button>
          <button className={`btn pri${canSubmit && !pending ? "" : " dis"}`} type="button" onClick={submit} aria-disabled={!canSubmit || pending}>
            {pending && <span className="spin" />}
            {replacement ? "Agendar reposição" : "Adicionar"}
          </button>
        </div>
      </div>
    </div>
  );
}
