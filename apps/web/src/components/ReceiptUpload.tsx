"use client";

import { useState } from "react";
import { uploadReceiptAction } from "@/app/(app)/pagamentos/actions";

/** Attaches a receipt (PDF or image) to one recorded payment. The file is checked again on the server. */
export function ReceiptUpload({ clientId, paymentId }: { clientId: string; paymentId: string }) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    setPending(true);
    setError(null);
    const r = await uploadReceiptAction(clientId, paymentId, new FormData(form));
    setPending(false);
    if (r.error) setError(r.error);
    else form.reset();
  }

  return (
    <form onSubmit={onSubmit} className="row" style={{ gap: 8, flexWrap: "wrap" }}>
      <input type="text" name="name" className="input" placeholder="Nome (opcional)" aria-label="Nome do comprovante" style={{ flex: "1 1 160px", height: 40 }} />
      <input type="file" name="file" className="input" accept=".pdf,.jpg,.jpeg,.png,.heic,.heif" required aria-label="Arquivo do comprovante" style={{ flex: "1 1 200px", height: 40, padding: "6px 10px" }} />
      <button className="btn pri sm" type="submit" disabled={pending}>{pending ? "Enviando…" : "Enviar"}</button>
      {error && <div className="errmsg" role="alert" style={{ flexBasis: "100%" }}>{error}</div>}
      <p className="help" style={{ flexBasis: "100%" }}>PDF, JPG, PNG ou HEIC, até 10MB.</p>
    </form>
  );
}
