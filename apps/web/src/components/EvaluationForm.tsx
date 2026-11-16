"use client";

import { useEffect, useState } from "react";
import { getForm, type ModalityKey, type RecordData } from "@fluxo/forms";
import type { FormState } from "@/app/(app)/clientes/actions";
import { useFormAction } from "@/lib/useFormAction";
import { FormFields } from "./forms/FormFields";
import { SubmitButton } from "./SubmitButton";

/** The evaluation of any modality, as a form inside the modal. Pre-filled when editing. */
export function EvaluationForm({
  modality, date: initialDate, data: initialData, action, onClose, onDelete,
}: {
  modality: ModalityKey;
  date: string;
  data: RecordData;
  action: (prev: FormState, formData: FormData) => Promise<FormState>;
  onClose: () => void;
  onDelete?: React.ReactNode;
}) {
  const def = getForm(modality, "evaluation");
  const { state, onSubmit, pending } = useFormAction<FormState>(action, undefined);

  // The dialog closes itself once the server has saved.
  useEffect(() => {
    if (state?.saved) onClose();
  }, [state?.saved, onClose]);
  const [data, setData] = useState<RecordData>(initialData);
  const [date, setDate] = useState(initialDate);

  return (
    <form onSubmit={onSubmit}>
      <input type="hidden" name="data" value={JSON.stringify(data)} />
      <div style={{ padding: "24px 28px", display: "flex", flexDirection: "column", gap: 4 }}>
        <div className="field" style={{ maxWidth: 220, marginBottom: 16 }}>
          <label className="label" htmlFor="date">Data</label>
          <input id="date" name="date" type="date" className="input" value={date} onChange={(e) => setDate(e.target.value)} required />
        </div>
        <FormFields def={def} value={data} onChange={setData} idPrefix="ev" plain />
        {state?.error && <div className="errmsg" role="alert">{state.error}</div>}
      </div>
      <div className="row" style={{ padding: "18px 28px", borderTop: "1px solid var(--line)", gap: 10 }}>
        {onDelete}
        <span style={{ marginLeft: "auto" }} />
        <button type="button" className="btn" onClick={onClose}>Cancelar</button>
        <div style={{ width: 120 }}><SubmitButton pendingLabel="Salvando…" height={44} pending={pending}>Salvar</SubmitButton></div>
      </div>
    </form>
  );
}
