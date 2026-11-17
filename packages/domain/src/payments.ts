import { addDays } from "./dates";

/** What the studio recorded for a due date. `pending` means nothing was recorded yet. */
export type PaymentStatus = "paid" | "unpaid" | "pending";

export function isPaymentStatus(v: unknown): v is PaymentStatus {
  return v === "paid" || v === "unpaid" || v === "pending";
}

export function isValidBillingDay(v: unknown): v is number {
  return typeof v === "number" && Number.isInteger(v) && v >= 1 && v <= 31;
}

/** The due date of `billingDay` in the month of `monthISO`: the day itself, or the last day of a shorter month. */
export function dueDateIn(monthISO: string, billingDay: number): string {
  const [y, m] = monthISO.split("-").map(Number);
  const lastDay = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return `${y}-${String(m).padStart(2, "0")}-${String(Math.min(billingDay, lastDay)).padStart(2, "0")}`;
}

/** The first due date on or after `today`. */
export function nextDueDate(billingDay: number, today: string): string {
  const thisMonth = dueDateIn(today, billingDay);
  if (thisMonth >= today) return thisMonth;
  const [y, m] = today.split("-").map(Number);
  const next = `${m === 12 ? y + 1 : y}-${String(m === 12 ? 1 : m + 1).padStart(2, "0")}-01`;
  return dueDateIn(next, billingDay);
}

/** Past due and not marked paid. An explicit "não pago" is still owed. */
export function isOverdue(dueDate: string, status: PaymentStatus, today: string): boolean {
  return status !== "paid" && dueDate < today;
}

/** Whole days since the due date (0 when it is today or in the future). */
export function daysOverdue(dueDate: string, today: string): number {
  let n = 0;
  for (let d = dueDate; d < today && n < 4000; d = addDays(d, 1)) n++;
  return n;
}
