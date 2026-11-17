"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { paymentLabels } from "@fluxo/copy";
import type { PaymentStatus } from "@fluxo/domain";
import { recordPayment } from "@/app/(app)/pagamentos/actions";

/** How a due date reads: recorded, late because nobody recorded it, or still ahead. */
export function paymentTone(status: PaymentStatus, overdue: boolean): { cls: string; dot: string; label: string } {
  if (status === "paid") return { cls: "st-ok", dot: "sd-ok", label: paymentLabels.paid };
  if (status === "unpaid") return { cls: "st-um", dot: "sd-um", label: paymentLabels.unpaid };
  if (overdue) return { cls: "st-jm", dot: "sd-jm", label: paymentLabels.overdue };
  return { cls: "st-no", dot: "sd-no", label: paymentLabels.upcoming };
}

/**
 * The status of one due date with the two manual actions. The chip changes the moment a button is pressed and goes
 * back with a message if the server refuses, so nothing waits on the network.
 */
export function PaymentActions({ clientId, dueDate, status: serverStatus, overdue, compact = false }: { clientId: string; dueDate: string; status: PaymentStatus; overdue: boolean; compact?: boolean }) {
  const router = useRouter();
  const [status, setStatus] = useState(serverStatus);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => setStatus(serverStatus), [serverStatus]);
  const tone = paymentTone(status, overdue);

  function choose(next: PaymentStatus) {
    const target = status === next ? "pending" : next; // pressing the active one clears it
    const previous = status;
    setError(null);
    setStatus(target);
    void recordPayment(clientId, dueDate, target).then((r) => {
      if (r.error) {
        setStatus(previous);
        setError(r.error);
      } else {
        // The chip already shows the new status; this brings in what depends on it (a receipt can now be attached, the Home list shrinks).
        router.refresh();
      }
    });
  }

  return (
    <div className="pay-actions">
      <span className={`st ${tone.cls}`}><span className={`sdot ${tone.dot}`} />{tone.label}</span>
      <div className="seg" role="group" aria-label="Registrar pagamento">
        <button type="button" className={status === "paid" ? "on" : ""} aria-pressed={status === "paid"} onClick={() => choose("paid")} style={compact ? { height: 32, padding: "0 10px" } : undefined}>{paymentLabels.paid}</button>
        <button type="button" className={status === "unpaid" ? "on" : ""} aria-pressed={status === "unpaid"} onClick={() => choose("unpaid")} style={compact ? { height: 32, padding: "0 10px" } : undefined}>{paymentLabels.unpaid}</button>
      </div>
      {error && <div className="errmsg" role="alert" style={{ flexBasis: "100%" }}>{error}</div>}
    </div>
  );
}
