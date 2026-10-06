"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db, friendly } from "@/lib/auth";
import { summarize } from "@/lib/apparatus";
import { formatBR } from "@/lib/dates";
import { isStatus, type AttendanceStatus } from "@/lib/status";

type Result = { error?: string };

function refresh() {
  revalidatePath("/");
  revalidatePath("/agenda");
  revalidatePath("/clientes", "layout");
}

const reasonSchema = z.string().trim().min(1).max(300);

/** A justified miss needs a reason. Every other status clears it. */
export async function setBookingStatus(bookingId: string, status: AttendanceStatus | null, reason?: string | null): Promise<Result> {
  if (status !== null && !isStatus(status)) return { error: "Status inválido." };
  let missReason: string | null = null;
  if (status === "JUSTIFIED_MISS") {
    const parsed = reasonSchema.safeParse(reason ?? "");
    if (!parsed.success) return { error: "Informe o motivo da falta (até 300 caracteres)." };
    missReason = parsed.data;
  }
  try {
    const supabase = await db();
    const { error } = await supabase.from("bookings").update({ status, miss_reason: missReason }).eq("id", bookingId);
    if (error) return { error: friendly(error) };
  } catch (e) {
    return { error: (e as Error).message };
  }
  refresh();
  return {};
}

export async function deleteBooking(bookingId: string): Promise<Result> {
  try {
    const supabase = await db();
    const { error } = await supabase.from("bookings").delete().eq("id", bookingId);
    if (error) return { error: friendly(error) };
  } catch (e) {
    return { error: (e as Error).message };
  }
  refresh();
  return {};
}

const bookingSchema = z.object({
  clientId: z.string().uuid("Escolha um cliente."),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Escolha uma data."),
  hour: z.coerce.number().int().min(6, "Horário inválido.").max(20, "Horário inválido."),
  replacesId: z.string().uuid().optional(),
});

/** Adds a client to a slot. With `replacesId` it is a replacement for that justified miss. */
export async function createBooking(input: { clientId: string; date: string; hour: number; replacesId?: string }): Promise<Result> {
  const parsed = bookingSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const { clientId, date, hour, replacesId } = parsed.data;
  try {
    const supabase = await db();
    const { data: client } = await supabase.from("clients").select("active").eq("id", clientId).single();
    if (!client?.active) return { error: "Clientes arquivados não recebem novos agendamentos." };
    const { error } = await supabase.from("bookings").insert({
      client_id: clientId,
      date,
      start_time: `${String(hour).padStart(2, "0")}:00`,
      status: replacesId ? "REPLACEMENT" : null,
      replaces_booking_id: replacesId ?? null,
    });
    if (error) return { error: friendly(error) };
  } catch (e) {
    return { error: (e as Error).message };
  }
  refresh();
  return {};
}

/** Latest evolution of a client, for the agenda popover. */
export async function getLastEvolution(clientId: string): Promise<{ date: string; title: string; text: string } | null> {
  try {
    const supabase = await db();
    const { data } = await supabase
      .from("evolutions")
      .select("date, apparatus")
      .eq("client_id", clientId)
      .order("date", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (!data) return null;
    const s = summarize(data.apparatus);
    return { date: formatBR(data.date as string), title: s.title, text: s.text };
  } catch {
    return null;
  }
}
