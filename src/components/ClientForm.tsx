"use client";

import Link from "next/link";
import type { FormState } from "@/app/(app)/clientes/actions";
import { maskPhone } from "@/lib/phone";
import { useFormAction } from "@/lib/useFormAction";
import { SubmitButton } from "./SubmitButton";

function onPhoneInput(e: React.FormEvent<HTMLInputElement>) {
  e.currentTarget.value = maskPhone(e.currentTarget.value);
}

export type ClientValues = {
  document: string;
  name: string;
  email: string;
  phone: string;
  emergency_contact_name: string;
  emergency_contact_phone: string;
  date_of_birth: string;
  instructor_id: string;
};

export const EMPTY_CLIENT: ClientValues = {
  document: "", name: "", email: "", phone: "", emergency_contact_name: "", emergency_contact_phone: "", date_of_birth: "", instructor_id: "",
};

/** Dados pessoais. Used to create a client and to edit one (formId links the tag lists on the side). */
export function ClientForm({
  formId, values, action, cancelHref, saved, instructors, canReassign,
}: {
  formId: string;
  values: ClientValues;
  action: (prev: FormState, formData: FormData) => Promise<FormState>;
  cancelHref: string;
  saved?: boolean;
  instructors: { id: string; name: string }[];
  canReassign: boolean;
}) {
  const { state, onSubmit, pending } = useFormAction<FormState>(action, undefined);
  return (
    <form id={formId} onSubmit={onSubmit} className="card" style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
        <h2 className="t-h2">Dados pessoais</h2>
        <div className="form-grid">
          <div className="field"><label className="label" htmlFor="document">Documento</label><input id="document" name="document" className="input" defaultValue={values.document} required placeholder="000.000.000-00" /></div>
          <div className="field"><label className="label" htmlFor="name">Nome</label><input id="name" name="name" className="input" defaultValue={values.name} required autoComplete="off" placeholder="Nome completo" /></div>
          <div className="field"><label className="label" htmlFor="email">E-mail</label><input id="email" name="email" type="email" className="input" defaultValue={values.email} placeholder="nome@exemplo.com" /></div>
          <div className="field"><label className="label" htmlFor="phone">Telefone</label><input id="phone" name="phone" type="tel" inputMode="tel" maxLength={15} className="input" defaultValue={maskPhone(values.phone)} onInput={onPhoneInput} placeholder="(11) 90000-0000" /></div>
          <div className="field"><label className="label" htmlFor="date_of_birth">Data de nascimento</label><input id="date_of_birth" name="date_of_birth" type="date" className="input" defaultValue={values.date_of_birth} /></div>
          <div className="field">
            <label className="label" htmlFor="instructor_id">Instrutor responsável</label>
            {canReassign ? (
              <select id="instructor_id" name="instructor_id" className="input" defaultValue={values.instructor_id}>
                <option value="">Sem instrutor</option>
                {instructors.map((i) => (
                  <option key={i.id} value={i.id}>{i.name}</option>
                ))}
              </select>
            ) : (
              <>
                <input className="input" value={instructors.find((i) => i.id === values.instructor_id)?.name ?? ""} disabled />
                <input type="hidden" name="instructor_id" value={values.instructor_id} />
              </>
            )}
          </div>
        </div>
      </div>

      <hr className="hair" />

      <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
        <h2 className="t-h3">Contato de emergência</h2>
        <div className="form-grid">
          <div className="field"><label className="label" htmlFor="emergency_contact_name">Nome</label><input id="emergency_contact_name" name="emergency_contact_name" className="input" defaultValue={values.emergency_contact_name} placeholder="Nome do contato" /></div>
          <div className="field"><label className="label" htmlFor="emergency_contact_phone">Telefone</label><input id="emergency_contact_phone" name="emergency_contact_phone" type="tel" inputMode="tel" maxLength={15} className="input" defaultValue={maskPhone(values.emergency_contact_phone)} onInput={onPhoneInput} placeholder="(11) 90000-0000" /></div>
        </div>
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
