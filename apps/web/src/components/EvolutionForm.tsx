"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { filledCount, getForm, type ModalityKey, type RecordData } from "@fluxo/forms";
import type { FormState } from "@/app/(app)/clientes/actions";
import { FormFields } from "./forms/FormFields";
import { Icon } from "./Icon";
import { SubmitButton } from "./SubmitButton";

export type SessionOption = { id: string; date: string; label: string };

type Props = {
  modality: ModalityKey;
  action: (prev: FormState, formData: FormData) => Promise<FormState>;
  cancelHref: string;
  initialDate: string;
  initialBookingId: string | null;
  initialSessionNumber: number;
  initialData: RecordData;
  sessions: SessionOption[];
  extra?: React.ReactNode;
};

/** The evolution of any modality: shared fields (date, session, number) plus the modality's own form. */
export function EvolutionForm({ modality, action, cancelHref, initialDate, initialBookingId, initialSessionNumber, initialData, sessions, extra }: Props) {
  const def = getForm(modality, "evolution");
  const [state, formAction] = useActionState(action, undefined);
  const [data, setData] = useState<RecordData>(initialData);
  const [date, setDate] = useState(initialDate);
  const [bookingId, setBookingId] = useState<string>(initialBookingId ?? "");
  const [sessionNumber, setSessionNumber] = useState(String(initialSessionNumber));

  const dirty =
    JSON.stringify(data) !== JSON.stringify(initialData) ||
    date !== initialDate ||
    bookingId !== (initialBookingId ?? "") ||
    sessionNumber !== String(initialSessionNumber);

  function chooseSession(id: string) {
    setBookingId(id);
    const s = sessions.find((x) => x.id === id);
    if (s) setDate(s.date);
  }

  return (
    <form action={formAction} style={{ display: "contents" }}>
      <input type="hidden" name="data" value={JSON.stringify(data)} />

      <div style={{ maxWidth: 880, display: "flex", flexDirection: "column", gap: 20 }}>
        <section className="card" style={{ display: "grid", gridTemplateColumns: "200px 140px minmax(0, 1fr)", gap: 18, alignItems: "start" }}>
          <div className="field">
            <label className="label" htmlFor="date">Data</label>
            <input id="date" name="date" type="date" className="input" value={date} onChange={(e) => setDate(e.target.value)} required />
          </div>
          <div className="field">
            <label className="label" htmlFor="session_number">Nº da sessão</label>
            <input id="session_number" name="session_number" type="number" min={1} className="input" value={sessionNumber} onChange={(e) => setSessionNumber(e.target.value)} required />
          </div>
          <div className="field">
            <label className="label" htmlFor="booking_id">Sessão vinculada <span className="faint" style={{ fontWeight: 400 }}>(opcional)</span></label>
            <select id="booking_id" name="booking_id" className="input" value={bookingId} onChange={(e) => chooseSession(e.target.value)}>
              <option value="">Sem sessão vinculada</option>
              {sessions.map((s) => (
                <option key={s.id} value={s.id}>{s.label}</option>
              ))}
            </select>
          </div>
          <p className="help" style={{ gridColumn: "1 / -1", display: "flex", alignItems: "center", gap: 8 }}>
            <Icon name="info" size={16} />
            Só é possível registrar evolução para quem esteve presente ou fez reposição.
          </p>
        </section>

        <FormFields def={def} value={data} onChange={setData} />

        {filledCount(def, data) === 0 && <p className="t-small muted">Preencha ao menos um campo da evolução.</p>}
        {state?.error && <div className="errmsg" role="alert">{state.error}</div>}
      </div>

      <div className="stickybar">
        {dirty && (
          <span className="st st-jm" style={{ height: 32 }}>
            <Icon name="alert" size={16} />
            Alterações não salvas
          </span>
        )}
        {extra}
        <span style={{ marginLeft: "auto" }} />
        <Link className="btn" href={cancelHref}>Cancelar</Link>
        <div style={{ minWidth: 170 }}><SubmitButton pendingLabel="Salvando…" height={44}>Salvar evolução</SubmitButton></div>
      </div>
    </form>
  );
}
