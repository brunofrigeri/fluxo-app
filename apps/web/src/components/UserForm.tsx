"use client";

import { useEffect, useState } from "react";
import type { FormState } from "@/app/(app)/usuarios/actions";
import { useFormAction } from "@/lib/useFormAction";
import { SubmitButton } from "./SubmitButton";

export type UserValues = { name: string; email: string; role: "admin" | "instructor"; working_hours: string; modality_ids: string[] };

/** Invite (email editable) or edit (email fixed) a user. Rendered inside the modal; closes itself once saved. */
export function UserForm({
  mode, values, action, onClose, modalities,
}: {
  mode: "invite" | "edit";
  values: UserValues;
  /** The modalities the studio offers: which ones this person teaches. */
  modalities: { id: string; name: string }[];
  action: (prev: FormState, formData: FormData) => Promise<FormState>;
  onClose: () => void;
}) {
  const { state, onSubmit, pending } = useFormAction<FormState>(action, undefined);
  const [role, setRole] = useState(values.role);
  // Admins are instructors by default: choosing Administrador ticks every modality (still editable).
  const [picked, setPicked] = useState<string[]>(values.modality_ids);

  useEffect(() => {
    if (state?.saved) onClose();
  }, [state?.saved, onClose]);

  function chooseRole(next: "admin" | "instructor") {
    setRole(next);
    if (next === "admin" && mode === "invite") setPicked(modalities.map((m) => m.id));
  }

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
          <select id="role" name="role" className="input" value={role} onChange={(e) => chooseRole(e.target.value as "admin" | "instructor")}>
            <option value="instructor">Instrutor</option>
            <option value="admin">Administrador</option>
          </select>
        </div>
        <fieldset className="regions" style={{ gridColumn: "1 / -1" }}>
          <legend className="label">Modalidades que ensina</legend>
          <div className="rchips">
            {modalities.map((m) => {
              const on = picked.includes(m.id);
              return (
                <label key={m.id} className={`rchip${on ? " on" : ""}`}>
                  <input type="checkbox" name="modality" value={m.id} checked={on} onChange={() => setPicked(on ? picked.filter((x) => x !== m.id) : [...picked, m.id])} />
                  {m.name}
                </label>
              );
            })}
          </div>
          <span className="help">Administradores também são instrutores: ensinam todas as modalidades do estúdio, a não ser que você desmarque. Um instrutor só pode ser responsável por clientes nas modalidades que ensina.</span>
        </fieldset>
        <div className="field" style={{ gridColumn: "1 / -1" }}>
          <label className="label" htmlFor="working_hours">Horário de trabalho</label>
          <input id="working_hours" name="working_hours" className="input" defaultValue={values.working_hours} placeholder="Ex.: Seg–Sex, 7h–19h" />
          <span className="help">Apenas informativo, não afeta a agenda.</span>
        </div>
        {state?.error && <div className="errmsg" role="alert" style={{ gridColumn: "1 / -1" }}>{state.error}</div>}
      </div>
      <div className="row" style={{ padding: "18px 28px", borderTop: "1px solid var(--line)", gap: 10, justifyContent: "flex-end" }}>
        <button type="button" className="btn" onClick={onClose}>Cancelar</button>
        <div style={{ width: 160 }}>
          <SubmitButton pendingLabel={mode === "invite" ? "Convidando…" : "Salvando…"} height={44} pending={pending}>
            {mode === "invite" ? "Enviar convite" : "Salvar"}
          </SubmitButton>
        </div>
      </div>
    </form>
  );
}
