"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import * as api from "@fluxo/api";
import { getAdmin } from "@/lib/admin";
import { db } from "@/lib/auth";
import { getStudioModalities, getTeachableModalities, type Modality } from "@/lib/modalities";

/** `saved` tells a dialog to close itself; those actions do not redirect, so the page stays where it is. */
export type FormState = { error?: string; saved?: boolean } | undefined;

const text = (v: FormDataEntryValue | null) => String(v ?? "").trim();
const orNull = (v: string) => (v === "" ? null : v);

function readClient(formData: FormData): api.ClientInput {
  return {
    document: text(formData.get("document")),
    name: text(formData.get("name")),
    email: orNull(text(formData.get("email"))),
    phone: orNull(text(formData.get("phone"))),
    emergency_contact_name: orNull(text(formData.get("emergency_contact_name"))),
    emergency_contact_phone: orNull(text(formData.get("emergency_contact_phone"))),
    date_of_birth: orNull(text(formData.get("date_of_birth"))),
    sex: orNull(text(formData.get("sex"))) as api.ClientInput["sex"],
    marital_status: orNull(text(formData.get("marital_status"))) as api.ClientInput["marital_status"],
    city: orNull(text(formData.get("city"))),
    profession: orNull(text(formData.get("profession"))),
    workplace: orNull(text(formData.get("workplace"))),
    children: orNull(text(formData.get("children"))),
    parents: orNull(text(formData.get("parents"))),
    billing_day: orNull(text(formData.get("billing_day"))) === null ? null : Number(text(formData.get("billing_day"))),
  };
}

/** The modalities ticked on the client form, each with its responsible instructor (only admins pick one). */
function readEnrollments(formData: FormData, offered: Modality[], me: { role: "admin" | "instructor" }): api.EnrollmentInput[] {
  const out: api.EnrollmentInput[] = [];
  for (const m of offered) {
    if (!formData.has(`mod_${m.key}`)) continue;
    const raw = me.role === "admin" ? text(formData.get(`instr_${m.key}`)) : "";
    out.push({ modalityId: m.id, instructorId: raw === "" ? null : raw });
  }
  return out;
}

export async function createClientAction(_prev: FormState, formData: FormData): Promise<FormState> {
  let created: api.CreateClientResult;
  try {
    const me = await getAdmin();
    if (!me?.studioId) return { error: "Sessão expirada. Entre novamente." };
    const enrollments = readEnrollments(formData, await getTeachableModalities(me), me);
    created = await api.registerClient(await db(), me, readClient(formData), enrollments);
  } catch (e) {
    return { error: (e as Error).message };
  }
  if (created.error || !created.id) return { error: created.error };
  revalidatePath("/clientes");
  // A client that starts in Acupuncture gets the evaluation right away (it can be skipped and done later).
  redirect(created.modalityKeys?.includes("acupuncture") ? `/clientes/${created.id}?aba=avaliacoes&avaliacao=nova&modalidade=acupuncture` : `/clientes/${created.id}?aba=dados`);
}

export async function updateClientAction(clientId: string, _prev: FormState, formData: FormData): Promise<FormState> {
  const list = (key: string) => formData.getAll(key).map((v) => String(v).trim()).filter(Boolean);
  try {
    const me = await getAdmin();
    if (!me) return { error: "Sessão expirada. Entre novamente." };
    const enrollments = me.role === "admin" ? readEnrollments(formData, await getStudioModalities(), me) : undefined;
    const r = await api.updateClient(
      await db(),
      me,
      clientId,
      readClient(formData),
      { diseases: list("diseases"), surgeries: list("surgeries"), current_treatments: list("current_treatments"), previous_treatments: list("previous_treatments"), medications: list("medications") },
      enrollments,
    );
    if (r.error) return { error: r.error };
  } catch (e) {
    return { error: (e as Error).message };
  }
  revalidatePath("/clientes", "layout");
  revalidatePath("/");
  redirect(`/clientes/${clientId}?aba=dados&salvo=1`);
}

export async function setArchived(clientId: string, archived: boolean): Promise<void> {
  const r = await api.setArchived(await db(), clientId, archived);
  if (r.error) throw new Error(r.error);
  revalidatePath("/clientes", "layout");
  revalidatePath("/agenda");
  revalidatePath("/");
  redirect(`/clientes/${clientId}?aba=dados`);
}

export async function addRecurringSlot(clientId: string, formData: FormData): Promise<void> {
  const r = await api.addRecurringSlot(await db(), clientId, { weekday: Number(formData.get("weekday")), hour: Number(formData.get("hour")), modalityId: String(formData.get("modality_id") ?? "") });
  if (r.error) throw new Error(r.error);
  revalidatePath(`/clientes/${clientId}`);
  revalidatePath("/agenda");
  revalidatePath("/");
}

export async function removeRecurringSlot(clientId: string, slotId: string): Promise<void> {
  const r = await api.removeRecurringSlot(await db(), slotId);
  if (r.error) throw new Error(r.error);
  revalidatePath(`/clientes/${clientId}`);
  revalidatePath("/agenda");
  revalidatePath("/");
}

// ---------------------------------------------------------------- evaluations and evolutions
//
// Both use the same tables for every modality: shared columns plus `data` (jsonb), validated against
// the modality's form definition (packages/forms) by @fluxo/api. Unknown keys are rejected, never stored.

function readJson(formData: FormData): unknown {
  try {
    return JSON.parse(text(formData.get("data")) || "{}");
  } catch {
    return undefined;
  }
}

export async function saveEvaluation(clientId: string, modalityKey: string, evaluationId: string | null, _prev: FormState, formData: FormData): Promise<FormState> {
  const data = readJson(formData);
  if (data === undefined) return { error: "Não foi possível ler os campos do formulário." };
  try {
    const r = await api.saveEvaluation(await db(), { clientId, modality: modalityKey, evaluationId, date: text(formData.get("date")), data });
    if (r.error) return { error: r.error };
  } catch (e) {
    return { error: (e as Error).message };
  }
  revalidatePath(`/clientes/${clientId}`);
  return { saved: true };
}

export async function deleteEvaluation(clientId: string, evaluationId: string): Promise<void> {
  const r = await api.deleteEvaluation(await db(), clientId, evaluationId);
  if (r.error) throw new Error(r.error);
  revalidatePath(`/clientes/${clientId}`);
}

export async function saveEvolution(clientId: string, modalityKey: string, evolutionId: string | null, _prev: FormState, formData: FormData): Promise<FormState> {
  const data = readJson(formData);
  if (data === undefined) return { error: "Não foi possível ler os campos do formulário." };
  let savedId: string;
  try {
    const r = await api.saveEvolution(await db(), {
      clientId,
      modality: modalityKey,
      evolutionId,
      date: text(formData.get("date")),
      bookingId: orNull(text(formData.get("booking_id"))),
      sessionNumber: Number.parseInt(text(formData.get("session_number")), 10),
      data,
    });
    if (r.error || !r.id) return { error: r.error };
    savedId = r.id;
  } catch (e) {
    return { error: (e as Error).message };
  }
  revalidatePath(`/clientes/${clientId}`);
  revalidatePath("/");
  redirect(`/clientes/${clientId}/evolucoes/${savedId}?salvo=1`);
}

export async function deleteEvolution(clientId: string, evolutionId: string): Promise<void> {
  const r = await api.deleteEvolution(await db(), clientId, evolutionId);
  if (r.error) throw new Error(r.error);
  revalidatePath(`/clientes/${clientId}`);
  revalidatePath("/");
  redirect(`/clientes/${clientId}?aba=evolucoes`);
}

// ---------------------------------------------------------------- documents

export async function uploadDocument(clientId: string, formData: FormData): Promise<void> {
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) throw new Error("Escolha um arquivo.");
  const r = await api.uploadDocument(await db(), { clientId, body: file, fileName: file.name, mimeType: file.type, sizeBytes: file.size, label: text(formData.get("name")) });
  if (r.error) throw new Error(r.error);
  revalidatePath(`/clientes/${clientId}`);
  redirect(`/clientes/${clientId}?aba=dados`);
}

export async function deleteDocument(clientId: string, documentId: string): Promise<void> {
  const r = await api.deleteDocument(await db(), clientId, documentId);
  if (r.error) throw new Error(r.error);
  revalidatePath(`/clientes/${clientId}`);
  redirect(`/clientes/${clientId}?aba=dados`);
}
