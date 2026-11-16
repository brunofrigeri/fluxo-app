"use client";

import { useFormStatus } from "react-dom";

/** Pass `pending` when the form is submitted with onSubmit (see useFormAction); otherwise it follows the form's action. */
export function SubmitButton({ children, pendingLabel, height = 48, pending: pendingProp }: { children: React.ReactNode; pendingLabel: string; height?: number; pending?: boolean }) {
  const status = useFormStatus();
  const pending = pendingProp ?? status.pending;
  return (
    <button type="submit" className={`btn pri${pending ? " load" : ""}`} style={{ width: "100%", height }} aria-disabled={pending}>
      {pending ? (
        <>
          <span className="spin" />
          {pendingLabel}
        </>
      ) : (
        children
      )}
    </button>
  );
}
