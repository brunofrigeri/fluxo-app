"use client";

import { useEffect, useRef } from "react";
import type { WaitState } from "@/app/(app)/espera/actions";
import { useFormAction } from "@/lib/useFormAction";
import { PERIODS, PERIOD_LABELS, type Period } from "@fluxo/domain";
import { SubmitButton } from "./SubmitButton";

type Props = {
  action: (prev: WaitState, formData: FormData) => Promise<WaitState>;
  initial?: { name: string; phone: string; period: Period; modalityId: string };
  /** The modalities the studio offers: the one the person is waiting for. */
  modalities: { id: string; name: string }[];
  /** Set when editing inside the modal: shows Cancelar and Salvar instead of the inline Adicionar button, and closes once saved. */
  onClose?: () => void;
};

export function WaitForm({ action, initial, onClose, modalities }: Props) {
  const { state, onSubmit, pending } = useFormAction(action, undefined as WaitState);
  const ref = useRef<HTMLFormElement>(null);
  const editing = onClose !== undefined;

  // After a successful add the fields are emptied (an edit closes instead). After an error they keep what was typed.
  useEffect(() => {
    if (!state?.saved) return;
    if (onClose) return onClose();
    ref.current?.reset();
    ref.current?.querySelector<HTMLInputElement>("input[name=name]")?.focus();
  }, [state?.saved, onClose]);

  const fields = (
    <>
      <div className="field">
        <label className="label" htmlFor="w-name">Nome</label>
        <input id="w-name" name="name" className="input" defaultValue={initial?.name ?? ""} required maxLength={120} autoComplete="off" />
      </div>
      <div className="field">
        <label className="label" htmlFor="w-phone">Telefone</label>
        <input id="w-phone" name="phone" type="tel" className="input" defaultValue={initial?.phone ?? ""} required maxLength={40} placeholder="(11) 90000-0000" autoComplete="off" />
      </div>
      {modalities.length > 1 && (
        <div className="field">
          <label className="label" htmlFor="w-modality">Modalidade</label>
          <select id="w-modality" name="modality_id" className="input" defaultValue={initial?.modalityId ?? modalities[0]?.id} required>
            {modalities.map((m) => (
              <option key={m.id} value={m.id}>{m.name}</option>
            ))}
          </select>
        </div>
      )}
      {modalities.length === 1 && <input type="hidden" name="modality_id" value={modalities[0].id} />}
      <div className="field">
        <label className="label" htmlFor="w-period">Período do dia</label>
        <select id="w-period" name="period" className="input" defaultValue={initial?.period ?? ""} required>
          <option value="" disabled>Escolha</option>
          {PERIODS.map((p) => (
            <option key={p} value={p}>{PERIOD_LABELS[p]}</option>
          ))}
        </select>
      </div>
    </>
  );

  if (editing) {
    return (
      <form ref={ref} onSubmit={onSubmit}>
        <div style={{ padding: "24px 28px", display: "flex", flexDirection: "column", gap: 18 }}>
          {fields}
          {state?.error && <div className="errmsg" role="alert">{state.error}</div>}
        </div>
        <div className="row" style={{ padding: "18px 28px", borderTop: "1px solid var(--line)", gap: 10, justifyContent: "flex-end" }}>
          <button type="button" className="btn" onClick={onClose}>Cancelar</button>
          <div style={{ width: 120 }}><SubmitButton pendingLabel="Salvando…" height={44} pending={pending}>Salvar</SubmitButton></div>
        </div>
      </form>
    );
  }

  return (
    <form ref={ref} onSubmit={onSubmit} className="wait-grid">
      {fields}
      <div style={{ minWidth: 140 }}><SubmitButton pendingLabel="Adicionando…" height={46} pending={pending}>Adicionar</SubmitButton></div>
      {state?.error && <div className="errmsg" role="alert" style={{ gridColumn: "1 / -1" }}>{state.error}</div>}
    </form>
  );
}
