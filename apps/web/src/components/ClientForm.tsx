"use client";

import Link from "next/link";
import { useState } from "react";
import type { ModalityKey } from "@fluxo/forms";
import type { FormState } from "@/app/(app)/clientes/actions";
import { MARITAL_OPTIONS, SEX_OPTIONS } from "@/lib/client-fields";
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
  sex: string;
  marital_status: string;
  city: string;
  profession: string;
  workplace: string;
  children: string;
  parents: string;
};

export const EMPTY_CLIENT: ClientValues = {
  document: "", name: "", email: "", phone: "", emergency_contact_name: "", emergency_contact_phone: "", date_of_birth: "",
  sex: "", marital_status: "", city: "", profession: "", workplace: "", children: "", parents: "",
};

/** A modality the client can be enrolled in, with the people who teach it (for the responsible instructor). */
export type ModalityChoice = { key: ModalityKey; name: string; instructors: { id: string; name: string }[] };

/** modality key -> responsible instructor id ("" = enrolled, nobody assigned). A missing key = not enrolled. */
export type Enrollment = Record<string, string>;

/** Dados pessoais. Used to create a client and to edit one (formId links the tag lists on the side). */
export function ClientForm({
  formId, values, action, cancelHref, saved, modalities, enrollment, canEditModalities, canReassign,
}: {
  formId: string;
  values: ClientValues;
  action: (prev: FormState, formData: FormData) => Promise<FormState>;
  cancelHref: string;
  saved?: boolean;
  /** The modalities this person may enroll the client in. */
  modalities: ModalityChoice[];
  enrollment: Enrollment;
  /** False for an instructor editing a client: they see the modalities but cannot change them. */
  canEditModalities: boolean;
  /** Only admins choose who is responsible; an instructor enrolling a client is the responsible one. */
  canReassign: boolean;
}) {
  const { state, onSubmit, pending } = useFormAction<FormState>(action, undefined);
  const [picked, setPicked] = useState<Enrollment>(() => (Object.keys(enrollment).length === 0 && modalities.length === 1 ? { [modalities[0].key]: "" } : enrollment));
  const toggle = (key: string) =>
    setPicked((p) => {
      const next = { ...p };
      if (key in next) delete next[key];
      else next[key] = "";
      return next;
    });
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
            <span className="label" id="sex-l">Sexo</span>
            <select id="sex" name="sex" className="input" aria-labelledby="sex-l" defaultValue={values.sex}>
              <option value="">Não informado</option>
              {SEX_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>
          <div className="field">
            <label className="label" htmlFor="marital_status">Estado civil</label>
            <select id="marital_status" name="marital_status" className="input" defaultValue={values.marital_status}>
              <option value="">Não informado</option>
              {MARITAL_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>
          <div className="field"><label className="label" htmlFor="city">Cidade</label><input id="city" name="city" className="input" defaultValue={values.city} maxLength={120} /></div>
          <div className="field"><label className="label" htmlFor="profession">Profissão</label><input id="profession" name="profession" className="input" defaultValue={values.profession} maxLength={120} /></div>
          <div className="field"><label className="label" htmlFor="workplace">Local de trabalho</label><input id="workplace" name="workplace" className="input" defaultValue={values.workplace} maxLength={120} /></div>
          <div className="field"><label className="label" htmlFor="children">Filhos</label><input id="children" name="children" className="input" defaultValue={values.children} maxLength={300} placeholder="Ex.: 2 filhos, 5 e 8 anos" /></div>
          <div className="field" style={{ gridColumn: "1 / -1" }}><label className="label" htmlFor="parents">Pais</label><input id="parents" name="parents" className="input" defaultValue={values.parents} maxLength={300} /></div>
        </div>
      </div>

      <hr className="hair" />

      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <h2 className="t-h3">Modalidades e instrutor responsável</h2>
        {canEditModalities ? (
          <>
            {modalities.map((m) => {
              const on = m.key in picked;
              return (
                <div key={m.key} className="row card flat" style={{ padding: "12px 14px", borderRadius: 12, gap: 14, flexWrap: "wrap", borderColor: on ? "var(--accent)" : undefined }}>
                  <label className="row" style={{ gap: 10, minWidth: 150, fontWeight: 600 }}>
                    <input type="checkbox" name={`mod_${m.key}`} checked={on} onChange={() => toggle(m.key)} style={{ accentColor: "var(--accent)", width: 18, height: 18 }} />
                    {m.name}
                  </label>
                  {on && canReassign && (
                    <select name={`instr_${m.key}`} className="input" aria-label={`Instrutor responsável em ${m.name}`} value={picked[m.key]} onChange={(e) => setPicked((p) => ({ ...p, [m.key]: e.target.value }))} style={{ flex: "1 1 220px", height: 40, width: "auto" }}>
                      <option value="">Sem instrutor</option>
                      {m.instructors.map((i) => (
                        <option key={i.id} value={i.id}>{i.name}</option>
                      ))}
                    </select>
                  )}
                  {on && !canReassign && <span className="t-small muted">Você será o responsável.</span>}
                </div>
              );
            })}
            {modalities.length === 0 && <p className="t-small muted">Você ainda não ensina nenhuma modalidade. Peça a um administrador para configurar.</p>}
            <p className="help">Escolha as modalidades do cliente{canReassign ? " e quem é o responsável em cada uma" : ""}. Cada instrutor vê o cliente só nas modalidades em que é responsável.</p>
          </>
        ) : (
          <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
            {modalities.filter((m) => m.key in enrollment).map((m) => (
              <span key={m.key} className={`mod mod-${m.key}`}>{m.name}</span>
            ))}
            <span className="t-small muted">Apenas administradores alteram as modalidades.</span>
          </div>
        )}
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
