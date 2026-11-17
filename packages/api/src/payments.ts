import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { addDays, isOverdue, isValidISO, nextDueDate, todayISO, type PaymentStatus } from "@fluxo/domain";
import { attempt, friendly, NOT_ALLOWED, touched, type Result } from "./errors";
import { DOCUMENTS_BUCKET, uploadDocument, type UploadInput } from "./documents";

// Payments are recorded by hand: the studio says "pago" or "não pago" for each due date. A due date nobody recorded
// is "pending", and once it is past it is overdue. The rules (who may read or write, which dates are valid) are in
// the database (migration 0014); only admins of the studio see any of this.

export type PaymentCycle = {
  clientId: string;
  clientName: string;
  /** The day the payment is due, "YYYY-MM-DD". */
  dueDate: string;
  status: PaymentStatus;
  /** Null while nothing was recorded. */
  paymentId: string | null;
  /** The day the money arrived (paid only). */
  paidOn: string | null;
  overdue: boolean;
};

type CycleRow = { client_id: string; client_name: string; due_date: string; status: PaymentStatus; payment_id: string | null; paid_on: string | null };

const toCycle = (r: CycleRow, today: string): PaymentCycle => ({
  clientId: r.client_id,
  clientName: r.client_name,
  dueDate: r.due_date,
  status: r.status,
  paymentId: r.payment_id,
  paidOn: r.paid_on,
  overdue: isOverdue(r.due_date, r.status, today),
});

/** Every due date between `from` and `to` (inclusive) of the studio's active clients with a payment day. `from: null` = since each client's billing began. */
export async function listPaymentCycles(supabase: SupabaseClient, from: string | null, to: string, today = todayISO()): Promise<PaymentCycle[]> {
  const { data, error } = await supabase.rpc("payment_cycles", { p_from: from, p_to: to });
  if (error) throw new Error(`pagamentos: ${error.message}`);
  return ((data ?? []) as CycleRow[]).map((r) => toCycle(r, today));
}

// ---------------------------------------------------------------- one client

export type Receipt = { id: string; paymentId: string; name: string; mimeType: string; sizeBytes: number; createdAt: string };
export type ClientPayment = { dueDate: string; status: PaymentStatus; paymentId: string | null; paidOn: string | null; overdue: boolean; receipts: Receipt[] };

/** Newest first: the next due date, then everything since the billing began, with each payment's receipts. */
export async function getClientPayments(supabase: SupabaseClient, clientId: string, today = todayISO()): Promise<{ billingDay: number | null; payments: ClientPayment[] }> {
  const { data: client, error: clientError } = await supabase.from("clients").select("billing_day").eq("id", clientId).maybeSingle();
  if (clientError) throw new Error(`cliente: ${clientError.message}`);
  const billingDay = (client?.billing_day as number | null | undefined) ?? null;
  if (billingDay === null) return { billingDay, payments: [] };

  const [cyclesRes, recordedRes, receiptsRes] = await Promise.all([
    supabase.rpc("payment_cycles", { p_from: null, p_to: nextDueDate(billingDay, today) }).eq("client_id", clientId),
    supabase.from("payments").select("id, due_date, status, paid_on").eq("client_id", clientId),
    supabase.from("documents").select("id, payment_id, name, mime_type, size_bytes, created_at").eq("client_id", clientId).not("payment_id", "is", null).order("created_at"),
  ]);
  if (cyclesRes.error) throw new Error(`pagamentos: ${cyclesRes.error.message}`);
  if (recordedRes.error) throw new Error(`pagamentos: ${recordedRes.error.message}`);
  if (receiptsRes.error) throw new Error(`comprovantes: ${receiptsRes.error.message}`);

  const byDate = new Map<string, ClientPayment>();
  for (const r of (cyclesRes.data ?? []) as CycleRow[]) byDate.set(r.due_date, { dueDate: r.due_date, status: r.status, paymentId: r.payment_id, paidOn: r.paid_on, overdue: isOverdue(r.due_date, r.status, today), receipts: [] });
  // Records made under an earlier billing day are not in the current cycles, but they are still history.
  for (const r of (recordedRes.data ?? []) as { id: string; due_date: string; status: PaymentStatus; paid_on: string | null }[]) {
    if (!byDate.has(r.due_date)) byDate.set(r.due_date, { dueDate: r.due_date, status: r.status, paymentId: r.id, paidOn: r.paid_on, overdue: false, receipts: [] });
  }
  const byPayment = new Map([...byDate.values()].filter((p) => p.paymentId).map((p) => [p.paymentId as string, p]));
  for (const d of (receiptsRes.data ?? []) as { id: string; payment_id: string; name: string; mime_type: string; size_bytes: number; created_at: string }[]) {
    byPayment.get(d.payment_id)?.receipts.push({ id: d.id, paymentId: d.payment_id, name: d.name, mimeType: d.mime_type, sizeBytes: d.size_bytes, createdAt: d.created_at });
  }
  return { billingDay, payments: [...byDate.values()].sort((a, b) => b.dueDate.localeCompare(a.dueDate)) };
}

// ---------------------------------------------------------------- recording

const recordSchema = z.object({
  clientId: z.string().uuid(),
  dueDate: z.string().refine(isValidISO, "Data de vencimento inválida."),
  status: z.enum(["paid", "unpaid", "pending"]),
  paidOn: z.string().refine(isValidISO, "Data do pagamento inválida.").nullish(),
});

export type RecordPaymentInput = { clientId: string; dueDate: string; status: PaymentStatus; paidOn?: string | null };

/**
 * Records one due date as paid or not paid, or clears the record (`pending`). Clearing also removes the receipts
 * attached to it. `paidOn` is when the money arrived and defaults to today.
 */
export function setPaymentStatus(supabase: SupabaseClient, input: RecordPaymentInput, today = todayISO()): Promise<Result> {
  return attempt(async () => {
    const parsed = recordSchema.safeParse(input);
    if (!parsed.success) return { error: parsed.error.issues[0].message };
    const { clientId, dueDate, status } = parsed.data;

    if (status === "pending") {
      const { data: row, error: findError } = await supabase.from("payments").select("id").eq("client_id", clientId).eq("due_date", dueDate).maybeSingle();
      if (findError) return { error: friendly(findError) };
      if (!row) {
        // Nothing visible to clear. That is fine only if the due date exists and is simply unrecorded; for someone who
        // cannot see payments at all (an instructor) it must not read as "done".
        const { data: cycle, error: cycleError } = await supabase.rpc("payment_cycles", { p_from: dueDate, p_to: dueDate }).eq("client_id", clientId).eq("due_date", dueDate);
        if (cycleError) return { error: friendly(cycleError) };
        return (cycle ?? []).length > 0 ? {} : { error: NOT_ALLOWED };
      }
      const { data: files } = await supabase.from("documents").select("storage_path").eq("payment_id", row.id as string);
      const paths = (files ?? []).map((f) => f.storage_path as string);
      if (paths.length > 0) await supabase.storage.from(DOCUMENTS_BUCKET).remove(paths);
      const { data, error } = await supabase.from("payments").delete().eq("id", row.id as string).select("id");
      if (error) return { error: friendly(error) };
      return touched(data) ? {} : { error: NOT_ALLOWED };
    }

    const paidOn = status === "paid" ? (parsed.data.paidOn ?? today) : null;
    if (paidOn && paidOn > today) return { error: "A data do pagamento não pode estar no futuro." };
    const { data, error } = await supabase
      .from("payments")
      .upsert({ client_id: clientId, due_date: dueDate, status, paid_on: paidOn, marked_at: new Date().toISOString() }, { onConflict: "client_id,due_date" })
      .select("id");
    if (error) return { error: friendly(error) };
    return touched(data) ? {} : { error: NOT_ALLOWED };
  });
}

/** Attaches a receipt (PDF or image) to a recorded payment. The same size and type limits as every document. */
export function uploadReceipt(supabase: SupabaseClient, input: Omit<UploadInput, "paymentId"> & { paymentId: string }): Promise<Result> {
  return uploadDocument(supabase, input);
}

// ---------------------------------------------------------------- the Home list

export type OverduePayment = {
  clientId: string;
  name: string;
  /** The oldest due date still open. */
  dueDate: string;
  /** How many due dates are open for this client. */
  count: number;
  /** True when the studio explicitly recorded "não pago" (as opposed to never recording anything). */
  unpaid: boolean;
};

/** Clients with a due date in the past that is not marked paid, oldest first: the studio forgot to update them, or they did not pay. */
export async function getOverduePayments(supabase: SupabaseClient, today = todayISO()): Promise<{ items: OverduePayment[]; total: number }> {
  const cycles = await listPaymentCycles(supabase, null, addDays(today, -1), today);
  const byClient = new Map<string, OverduePayment>();
  for (const c of cycles) {
    if (!c.overdue) continue;
    const cur = byClient.get(c.clientId);
    if (!cur) byClient.set(c.clientId, { clientId: c.clientId, name: c.clientName, dueDate: c.dueDate, count: 1, unpaid: c.status === "unpaid" });
    else {
      cur.count += 1;
      cur.unpaid = cur.unpaid || c.status === "unpaid";
    }
  }
  const items = [...byClient.values()].sort((a, b) => a.dueDate.localeCompare(b.dueDate) || a.name.localeCompare(b.name));
  return { items, total: items.length };
}
