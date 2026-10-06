"use client";

import Link from "next/link";
import type { FormState } from "@/app/(app)/clientes/actions";
import { useFormAction } from "@/lib/useFormAction";
import { SubmitButton } from "./SubmitButton";

export type ClientValues = {
  document: string;
  name: string;
  email: string;
  phone: string;
  emergency_contact_name: string;
  emergency_contact_phone: string;
  date_of_birth: string;
};

export const EMPTY_CLIENT: ClientValues = {
  document: "", name: "", email: "", phone: "", emergency_contact_name: "", emergency_contact_phone: "", date_of_birth: "",
};

/** Dados pessoais. Used to create a client and to edit one (formId links the tag lists on the side). */
export function ClientForm({
  formId, values, action, cancelHref, saved,
}: {
  formId: string;
  values: ClientValues;
  action: (prev: FormState, formData: FormData) => Promise<FormState>;
  cancelHref: string;
  saved?: boolean;
}) {
  const { state, onSubmit, pending } = useFormAction<FormState>(action, undefined);
  return (
    <form id={formId} onSubmit={onSubmit} className="card" style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <h2 className="t-h2">Dados pessoais</h2>
      <div className="form-grid">
        <div className="field"><label className="label" htmlFor="document">Documento</label><input id="document" name="document" className="input" defaultValue={values.document} required placeholder="CPF" /></div>
        <div className="field"><label className="label" htmlFor="name">Nome</label><input id="name" name="name" className="input" defaultValue={values.name} required autoComplete="off" /></div>
        <div className="field"><label className="label" htmlFor="email">E-mail</label><input id="email" name="email" type="email" className="input" defaultValue={values.email} /></div>
        <div className="field"><label className="label" htmlFor="phone">Telefone</label><input id="phone" name="phone" type="tel" className="input" defaultValue={values.phone} placeholder="(11) 90000-0000" /></div>
        <div className="field"><label className="label" htmlFor="emergency_contact_name">Contato de emergência</label><input id="emergency_contact_name" name="emergency_contact_name" className="input" defaultValue={values.emergency_contact_name} placeholder="Nome" /></div>
        <div className="field"><label className="label" htmlFor="emergency_contact_phone">Telefone do contato</label><input id="emergency_contact_phone" name="emergency_contact_phone" type="tel" className="input" defaultValue={values.emergency_contact_phone} /></div>
        <div className="field"><label className="label" htmlFor="date_of_birth">Data de nascimento</label><input id="date_of_birth" name="date_of_birth" type="date" className="input" defaultValue={values.date_of_birth} /></div>
      </div>
      {state?.error && <div className="errmsg" role="alert">{state.error}</div>}
      {saved && !state?.error && <div className="errmsg" role="status" style={{ background: "var(--ok-bg)", color: "var(--ok-fg)" }}>Dados salvos.</div>}
      <div className="row" style={{ justifyContent: "flex-end", gap: 10 }}>
        <Link className="btn" href={cancelHref}>Cancelar</Link>
        <div style={{ width: 140 }}><SubmitButton pendingLabel="Salvando…" height={44} pending={pending}>Salvar</SubmitButton></div>
      </div>
    </form>
  );
}
