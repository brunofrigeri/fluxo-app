"use client";

import Link from "next/link";
import type { FormState } from "@/app/(app)/usuarios/actions";
import { useFormAction } from "@/lib/useFormAction";
import { SubmitButton } from "./SubmitButton";

export type UserValues = { name: string; email: string; role: "admin" | "instructor"; working_hours: string };

/** Invite (email editable) or edit (email fixed) a user. Rendered inside the modal. */
export function UserForm({
  mode, values, action, closeHref,
}: {
  mode: "invite" | "edit";
  values: UserValues;
  action: (prev: FormState, formData: FormData) => Promise<FormState>;
  closeHref: string;
}) {
  const { state, onSubmit, pending } = useFormAction<FormState>(action, undefined);
  return (
    <form onSubmit={onSubmit}>
      <div style={{ padding: "24px 28px" }} className="form-grid">
        <div className="field"><label className="label" htmlFor="name">Nome</label><input id="name" name="name" className="input" defaultValue={values.name} required autoComplete="off" placeholder="Nome completo" /></div>
        {mode === "invite" ? (
          <div className="field"><label className="label" htmlFor="email">E-mail</label><input id="email" name="email" type="email" className="input" defaultValue={values.email} required placeholder="nome@exemplo.com" /></div>
        ) : (
          <div className="field"><label className="label" htmlFor="email-ro">E-mail</label><input id="email-ro" className="input" value={values.email} disabled /></div>
        )}
        <div className="field">
          <label className="label" htmlFor="role">Papel</label>
          <select id="role" name="role" className="input" defaultValue={values.role}>
            <option value="instructor">Instrutor</option>
            <option value="admin">Administrador</option>
          </select>
        </div>
        <div className="field" style={{ gridColumn: "1 / -1" }}>
          <label className="label" htmlFor="working_hours">Horário de trabalho</label>
          <input id="working_hours" name="working_hours" className="input" defaultValue={values.working_hours} placeholder="Ex.: Seg–Sex, 7h–19h" />
          <span className="help">Apenas informativo, não afeta a agenda.</span>
        </div>
        {state?.error && <div className="errmsg" role="alert" style={{ gridColumn: "1 / -1" }}>{state.error}</div>}
      </div>
      <div className="row" style={{ padding: "18px 28px", borderTop: "1px solid var(--line)", gap: 10, justifyContent: "flex-end" }}>
        <Link className="btn" href={closeHref}>Cancelar</Link>
        <div style={{ width: 160 }}>
          <SubmitButton pendingLabel={mode === "invite" ? "Convidando…" : "Salvando…"} height={44} pending={pending}>
            {mode === "invite" ? "Enviar convite" : "Salvar"}
          </SubmitButton>
        </div>
      </div>
    </form>
  );
}
