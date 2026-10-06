"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";
import type { WaitState } from "@/app/(app)/espera/actions";
import { useFormAction } from "@/lib/useFormAction";
import { PERIODS, PERIOD_LABELS, type Period } from "@/lib/waitlist";
import { SubmitButton } from "./SubmitButton";

type Props = {
  action: (prev: WaitState, formData: FormData) => Promise<WaitState>;
  initial?: { name: string; phone: string; period: Period };
  /** Set when editing inside the modal: shows Cancelar and Salvar instead of the inline Adicionar button. */
  closeHref?: string;
};

export function WaitForm({ action, initial, closeHref }: Props) {
  const { state, onSubmit, pending } = useFormAction(action, undefined as WaitState);
  const ref = useRef<HTMLFormElement>(null);
  const editing = closeHref !== undefined;

  // After a successful add the fields are emptied. After an error they keep what was typed.
  useEffect(() => {
    if (state?.saved) {
      ref.current?.reset();
      ref.current?.querySelector<HTMLInputElement>("input[name=name]")?.focus();
    }
  }, [state?.saved]);

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
          <Link className="btn" href={closeHref}>Cancelar</Link>
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
