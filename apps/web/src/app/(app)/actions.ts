"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getAdmin } from "@/lib/admin";
import { db, friendly } from "@/lib/auth";
import { getForm, isModalityKey, summarize } from "@fluxo/forms";
import { formatBR } from "@fluxo/domain";
import { getDialogClients, type DialogClient } from "@/lib/queries/agenda";
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

const bookingSchema = z
  .object({
    clientId: z.string().uuid("Escolha um cliente."),
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Escolha uma data."),
    hour: z.coerce.number().int().min(6, "Horário inválido.").max(20, "Horário inválido."),
    replacesId: z.string().uuid().optional(),
    modalityId: z.string().uuid("Escolha a modalidade.").optional(),
    label: z.string().trim().min(1, "Informe o nome da atividade.").max(80, "Nome da atividade muito longo.").optional(),
  })
  .refine((v) => (v.modalityId === undefined) !== (v.label === undefined), { message: "Escolha a modalidade." })
  .refine((v) => v.label === undefined || v.replacesId === undefined, { message: "Atividades avulsas não têm reposição." });

/**
 * Adds a client to a slot, in a modality, or as a labelled one-off entry (`label`, no modality and
 * no evolution form). With `replacesId` it is a replacement for that justified miss.
 */
export async function createBooking(input: { clientId: string; date: string; hour: number; replacesId?: string; modalityId?: string; label?: string }): Promise<Result> {
  const parsed = bookingSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const { clientId, date, hour, replacesId, modalityId, label } = parsed.data;
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
      modality_id: modalityId ?? null,
      label: label ?? null,
    });
    if (error) return { error: friendly(error) };
  } catch (e) {
    return { error: (e as Error).message };
  }
  refresh();
  return {};
}

/** Active clients with their pending justified misses, fetched on demand when the add-booking dialog opens. */
export async function getDialogClientsAction(): Promise<DialogClient[]> {
  return getDialogClients();
}

/** A shared note for a class slot (date + hour + modality), independent of any one client. */
export async function getSessionNote(date: string, hour: number, modalityId: string): Promise<string | null> {
  try {
    const supabase = await db();
    const { data } = await supabase
      .from("session_notes")
      .select("note")
      .eq("modality_id", modalityId)
      .eq("date", date)
      .eq("start_time", `${String(hour).padStart(2, "0")}:00`)
      .maybeSingle();
    return (data?.note as string | undefined) ?? null;
  } catch {
    return null;
  }
}

const noteSchema = z.string().trim().max(2000);

export async function saveSessionNote(date: string, hour: number, modalityId: string, note: string): Promise<Result> {
  const parsed = noteSchema.safeParse(note);
  if (!parsed.success) return { error: "Nota muito longa." };
  const start_time = `${String(hour).padStart(2, "0")}:00`;
  try {
    const me = await getAdmin();
    if (!me?.studioId) return { error: "Sessão expirada. Entre novamente." };
    const supabase = await db();
    if (parsed.data === "") {
      const { error } = await supabase.from("session_notes").delete().eq("modality_id", modalityId).eq("date", date).eq("start_time", start_time);
      if (error) return { error: friendly(error) };
    } else {
      const { error } = await supabase
        .from("session_notes")
        .upsert({ studio_id: me.studioId, modality_id: modalityId, date, start_time, note: parsed.data, updated_at: new Date().toISOString() }, { onConflict: "studio_id,date,start_time,modality_id" });
      if (error) return { error: friendly(error) };
    }
  } catch (e) {
    return { error: (e as Error).message };
  }
  refresh();
  return {};
}

/** Latest evolution of a client in one modality, for the agenda popover. */
export async function getLastEvolution(clientId: string, modalityId: string): Promise<{ date: string; title: string; text: string } | null> {
  try {
    const supabase = await db();
    const { data } = await supabase
      .from("evolutions")
      .select("date, data, modalities(key)")
      .eq("client_id", clientId)
      .eq("modality_id", modalityId)
      .order("date", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (!data) return null;
    const m = data.modalities as { key: string } | { key: string }[] | null;
    const key = Array.isArray(m) ? m[0]?.key : m?.key;
    if (!isModalityKey(key)) return null;
    const s = summarize(getForm(key, "evolution"), data.data as Record<string, unknown>);
    return { date: formatBR(data.date as string), title: s.title, text: s.text };
  } catch {
    return null;
  }
}
