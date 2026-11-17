"use server";

// Payments are recorded by hand. The rules live in @fluxo/api (and the database); each action checks the session,
// calls it, and revalidates only the pages that show payments.

import { revalidatePath } from "next/cache";
import * as api from "@fluxo/api";
import type { PaymentStatus } from "@fluxo/domain";
import { db } from "@/lib/auth";

function refresh(clientId: string) {
  revalidatePath("/pagamentos");
  revalidatePath("/");
  revalidatePath("/agenda");
  revalidatePath(`/clientes/${clientId}`);
}

async function run(clientId: string, fn: (s: Awaited<ReturnType<typeof db>>) => Promise<api.Result>): Promise<api.Result> {
  let result: api.Result;
  try {
    result = await fn(await db());
  } catch (e) {
    return { error: (e as Error).message };
  }
  if (!result.error) refresh(clientId);
  return result;
}

/** Says "pago" or "não pago" for one due date, or clears the record (`pending`). `paidOn` defaults to today. */
export async function recordPayment(clientId: string, dueDate: string, status: PaymentStatus, paidOn?: string | null): Promise<api.Result> {
  return run(clientId, (s) => api.setPaymentStatus(s, { clientId, dueDate, status, paidOn }));
}

export async function uploadReceiptAction(clientId: string, paymentId: string, formData: FormData): Promise<api.Result> {
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) return { error: "Escolha um arquivo." };
  return run(clientId, (s) => api.uploadReceipt(s, { clientId, paymentId, body: file, fileName: file.name, mimeType: file.type, sizeBytes: file.size, label: String(formData.get("name") ?? "").trim() }));
}

export async function deleteReceiptAction(clientId: string, documentId: string): Promise<api.Result> {
  return run(clientId, (s) => api.deleteDocument(s, clientId, documentId));
}

/** For a plain `<form action>`: failing throws, like the other delete actions. */
export async function removeReceipt(clientId: string, documentId: string): Promise<void> {
  const r = await deleteReceiptAction(clientId, documentId);
  if (r.error) throw new Error(r.error);
}
