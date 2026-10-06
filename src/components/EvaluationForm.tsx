"use client";

import Link from "next/link";
import type { FormState } from "@/app/(app)/clientes/actions";
import { useFormAction } from "@/lib/useFormAction";
import { SubmitButton } from "./SubmitButton";

export type EvaluationValues = {
  date: string;
  main_complaint: string;
  diagnosis: string;
  hdp: string;
  hda: string;
  medications: string;
  movement_restrictions: string;
  obs: string;
};

/** The evaluation as a form, pre-filled when editing. Rendered inside the modal. */
export function EvaluationForm({
  values, action, closeHref, onDelete,
}: {
  values: EvaluationValues;
  action: (prev: FormState, formData: FormData) => Promise<FormState>;
  closeHref: string;
  onDelete?: React.ReactNode;
}) {
  const { state, onSubmit, pending } = useFormAction<FormState>(action, undefined);
  return (
    <form onSubmit={onSubmit}>
      <div style={{ padding: "24px 28px" }} className="form-grid">
        <div className="field"><label className="label" htmlFor="date">Data</label><input id="date" name="date" type="date" className="input" defaultValue={values.date} required /></div>
        <div className="field"><label className="label" htmlFor="diagnosis">Diagnóstico</label><input id="diagnosis" name="diagnosis" className="input" defaultValue={values.diagnosis} /></div>
        <div className="field" style={{ gridColumn: "1 / -1" }}><label className="label" htmlFor="main_complaint">Queixa principal</label><input id="main_complaint" name="main_complaint" className="input" defaultValue={values.main_complaint} /></div>
        <div className="field"><label className="label" htmlFor="hdp">HDP</label><span className="help" style={{ marginTop: -4 }}>História da doença pregressa</span><textarea id="hdp" name="hdp" className="input" rows={3} defaultValue={values.hdp} /></div>
        <div className="field"><label className="label" htmlFor="hda">HDA</label><span className="help" style={{ marginTop: -4 }}>História da doença atual</span><textarea id="hda" name="hda" className="input" rows={3} defaultValue={values.hda} /></div>
        <div className="field"><label className="label" htmlFor="medications">Medicações</label><textarea id="medications" name="medications" className="input" rows={2} defaultValue={values.medications} /></div>
        <div className="field"><label className="label" htmlFor="movement_restrictions">Restrições de movimento</label><textarea id="movement_restrictions" name="movement_restrictions" className="input" rows={2} defaultValue={values.movement_restrictions} /></div>
        <div className="field" style={{ gridColumn: "1 / -1" }}><label className="label" htmlFor="obs">Observações</label><textarea id="obs" name="obs" className="input" rows={2} defaultValue={values.obs} /></div>
        {state?.error && <div className="errmsg" role="alert" style={{ gridColumn: "1 / -1" }}>{state.error}</div>}
      </div>
      <div className="row" style={{ padding: "18px 28px", borderTop: "1px solid var(--line)", gap: 10 }}>
        {onDelete}
        <span style={{ marginLeft: "auto" }} />
        <Link className="btn" href={closeHref}>Cancelar</Link>
        <div style={{ width: 120 }}><SubmitButton pendingLabel="Salvando…" height={44} pending={pending}>Salvar</SubmitButton></div>
      </div>
    </form>
  );
}
