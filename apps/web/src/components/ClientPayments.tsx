import * as api from "@fluxo/api";
import { paymentCopy } from "@fluxo/copy";
import { formatBR, formatShort, todayISO } from "@fluxo/domain";
import { Icon } from "@fluxo/ui-web";
import { removeReceipt } from "@/app/(app)/pagamentos/actions";
import { createClient } from "@/lib/supabase/server";
import { ConfirmButton } from "./ConfirmButton";
import { PaymentActions } from "./PaymentActions";
import { ReceiptUpload } from "./ReceiptUpload";

/** The "Pagamentos" tab of a client: every due date with its status, and the receipts attached to each payment. Admins only. */
export async function ClientPayments({ clientId }: { clientId: string }) {
  const today = todayISO();
  const { billingDay, payments } = await api.getClientPayments(await createClient(), clientId, today);

  if (billingDay === null) {
    return (
      <section className="card">
        <div className="empty">
          <div className="badge"><Icon name="calendar" /></div>
          <b style={{ color: "var(--ink)" }}>Sem dia de pagamento</b>
          <span className="t-small">Defina o {paymentCopy.billingDay.toLowerCase()} na aba Dados para acompanhar os vencimentos deste cliente.</span>
        </div>
      </section>
    );
  }

  return (
    <section className="card" style={{ padding: 0 }}>
      <div className="row" style={{ padding: "20px 24px", borderBottom: "1px solid var(--line)" }}>
        <h2 className="t-h2 grow">{paymentCopy.title}</h2>
        <span className="pill">Vence todo dia {billingDay}</span>
      </div>
      {payments.length === 0 ? (
        <p className="t-small muted" style={{ padding: 24 }}>O primeiro vencimento ainda não chegou.</p>
      ) : (
        payments.map((p) => (
          <div key={p.dueDate} className="pay-item">
            <div className="row" style={{ gap: 12, flexWrap: "wrap" }}>
              <div className="grow">
                <b>{formatShort(p.dueDate)}</b>
                {p.status === "paid" && p.paidOn && <div className="t-small muted">{paymentCopy.paidOn} {formatBR(p.paidOn)}</div>}
              </div>
              <PaymentActions clientId={clientId} dueDate={p.dueDate} status={p.status} overdue={p.overdue} />
            </div>

            {p.receipts.map((r) => (
              <div className="li" key={r.id}>
                <Icon name="note" size={16} className="faint" />
                <a className="grow" style={{ fontWeight: 600, color: "var(--ink)", textDecoration: "none" }} href={`/clientes/${clientId}/documentos/${r.id}`} target="_blank" rel="noopener noreferrer">{r.name}</a>
                <span className="t-small muted">{api.formatSize(r.sizeBytes)}</span>
                <form action={removeReceipt.bind(null, clientId, r.id)}>
                  <ConfirmButton className="ibtn" ariaLabel="Remover comprovante" message={`Remover "${r.name}"? Isso não pode ser desfeito.`}>
                    <Icon name="x" size={16} />
                  </ConfirmButton>
                </form>
              </div>
            ))}

            {p.paymentId ? (
              <details>
                <summary className="btn sm" style={{ listStyle: "none", width: "fit-content" }}>
                  <Icon name="plus" size={16} />
                  {paymentCopy.addReceipt}
                </summary>
                <div style={{ marginTop: 12 }}><ReceiptUpload clientId={clientId} paymentId={p.paymentId} /></div>
              </details>
            ) : (
              <p className="t-small faint">Registre o pagamento para anexar um comprovante.</p>
            )}
          </div>
        ))
      )}
    </section>
  );
}
