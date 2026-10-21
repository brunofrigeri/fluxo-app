"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { getForm, isEmptyData, isModalityKey, parseData, type ModalityKey } from "@fluxo/forms";
import { getAdmin } from "@/lib/admin";
import { db, friendly } from "@/lib/auth";
import { todayISO } from "@/lib/dates";
import { getModalities, getStudioModalities, getTeachableModalities, type Modality } from "@/lib/modalities";

/** `saved` tells a dialog to close itself; those actions do not redirect, so the page stays where it is. */
export type FormState = { error?: string; saved?: boolean } | undefined;

const text = (v: FormDataEntryValue | null) => String(v ?? "").trim();
const orNull = (v: string) => (v === "" ? null : v);

const clientSchema = z.object({
  document: z.string().min(1, "Informe o documento."),
  name: z.string().min(2, "Informe o nome."),
  email: z.string().email("E-mail inválido.").nullable(),
  phone: z.string().nullable(),
  emergency_contact_name: z.string().nullable(),
  emergency_contact_phone: z.string().nullable(),
  date_of_birth: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Data de nascimento inválida.").nullable(),
  // Shared client data (the same for every modality), filled once.
  sex: z.enum(["female", "male", "other"], { message: "Sexo inválido." }).nullable(),
  marital_status: z.enum(["single", "married", "stable_union", "divorced", "widowed"], { message: "Estado civil inválido." }).nullable(),
  city: z.string().max(120).nullable(),
  profession: z.string().max(120).nullable(),
  workplace: z.string().max(120).nullable(),
  children: z.string().max(300).nullable(),
  parents: z.string().max(300).nullable(),
});

function readClient(formData: FormData) {
  return clientSchema.safeParse({
    document: text(formData.get("document")),
    name: text(formData.get("name")),
    email: orNull(text(formData.get("email"))),
    phone: orNull(text(formData.get("phone"))),
    emergency_contact_name: orNull(text(formData.get("emergency_contact_name"))),
    emergency_contact_phone: orNull(text(formData.get("emergency_contact_phone"))),
    date_of_birth: orNull(text(formData.get("date_of_birth"))),
    sex: orNull(text(formData.get("sex"))),
    marital_status: orNull(text(formData.get("marital_status"))),
    city: orNull(text(formData.get("city"))),
    profession: orNull(text(formData.get("profession"))),
    workplace: orNull(text(formData.get("workplace"))),
    children: orNull(text(formData.get("children"))),
    parents: orNull(text(formData.get("parents"))),
  });
}

const uuid = z.string().uuid();

/** The modalities ticked on the client form, each with its responsible instructor (or none). */
type Enrollment = { modality: Modality; instructorId: string | null };

function readEnrollments(formData: FormData, allowed: Modality[], me: { id: string; role: "admin" | "instructor" }): Enrollment[] | string {
  const out: Enrollment[] = [];
  for (const m of allowed) {
    if (!formData.has(`mod_${m.key}`)) continue;
    // Only admins pick the instructor. An instructor enrolling a client is the responsible one.
    const raw = me.role === "admin" ? text(formData.get(`instr_${m.key}`)) : me.id;
    if (raw !== "" && !uuid.safeParse(raw).success) return "Instrutor inválido.";
    out.push({ modality: m, instructorId: raw === "" ? null : raw });
  }
  if (out.length === 0) return "Escolha ao menos uma modalidade.";
  return out;
}

export async function createClientAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = readClient(formData);
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  let id: string;
  let enrolls: Enrollment[];
  try {
    const me = await getAdmin();
    if (!me?.studioId) return { error: "Sessão expirada. Entre novamente." };
    const allowed = await getTeachableModalities(me);
    const read = readEnrollments(formData, allowed, me);
    if (typeof read === "string") return { error: read };
    enrolls = read;

    const supabase = await db();
    const { data, error } = await supabase.from("clients").insert({ ...parsed.data, studio_id: me.studioId }).select("id").single();
    if (error) return { error: friendly(error) };
    id = data.id as string;

    const { error: enrollError } = await supabase
      .from("client_modality_instructors")
      .insert(enrolls.map((e) => ({ client_id: id, modality_id: e.modality.id, instructor_id: e.instructorId })));
    if (enrollError) {
      // Do not leave a client nobody is enrolled for.
      await supabase.from("clients").delete().eq("id", id);
      return { error: friendly(enrollError) };
    }
  } catch (e) {
    return { error: (e as Error).message };
  }
  revalidatePath("/clientes");
  // A client that starts in Acupuncture gets the evaluation right away (it can be skipped and done later).
  const acupuncture = enrolls.find((e) => e.modality.key === "acupuncture");
  redirect(acupuncture ? `/clientes/${id}?aba=avaliacoes&avaliacao=nova&modalidade=acupuncture` : `/clientes/${id}?aba=dados`);
}

export async function updateClientAction(clientId: string, _prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = readClient(formData);
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const list = (key: string) => formData.getAll(key).map((v) => String(v).trim()).filter(Boolean);
  try {
    const me = await getAdmin();
    if (!me) return { error: "Sessão expirada. Entre novamente." };
    const supabase = await db();
    const { error } = await supabase
      .from("clients")
      .update({
        ...parsed.data,
        diseases: list("diseases"),
        surgeries: list("surgeries"),
        current_treatments: list("current_treatments"),
        previous_treatments: list("previous_treatments"),
        medications: list("medications"),
      })
      .eq("id", clientId);
    if (error) return { error: friendly(error) };

    // Only admins change who is responsible, and which modalities the client is in.
    if (me.role === "admin") {
      const read = readEnrollments(formData, await getStudioModalities(), me);
      if (typeof read === "string") return { error: read };
      const { data: current, error: currentError } = await supabase.from("client_modality_instructors").select("modality_id").eq("client_id", clientId);
      if (currentError) return { error: friendly(currentError) };
      const had = new Set((current ?? []).map((r) => r.modality_id as string));
      const want = new Set(read.map((e) => e.modality.id));

      const { error: upsertError } = await supabase
        .from("client_modality_instructors")
        .upsert(read.map((e) => ({ client_id: clientId, modality_id: e.modality.id, instructor_id: e.instructorId })), { onConflict: "client_id,modality_id" });
      if (upsertError) return { error: friendly(upsertError) };

      const removed = [...had].filter((m) => !want.has(m));
      if (removed.length > 0) {
        const { error: removeError } = await supabase.from("client_modality_instructors").delete().eq("client_id", clientId).in("modality_id", removed);
        if (removeError) return { error: friendly(removeError) };
      }
    }
  } catch (e) {
    return { error: (e as Error).message };
  }
  revalidatePath("/clientes", "layout");
  revalidatePath("/");
  redirect(`/clientes/${clientId}?aba=dados&salvo=1`);
}

export async function setArchived(clientId: string, archived: boolean): Promise<void> {
  const supabase = await db();
  const { error } = await supabase.from("clients").update({ active: !archived }).eq("id", clientId);
  if (error) throw new Error(friendly(error));
  if (archived) {
    // Archived clients leave the future agenda, but everything already marked stays as history.
    await supabase.from("bookings").delete().eq("client_id", clientId).gte("date", todayISO()).is("status", null);
  } else {
    await supabase.rpc("generate_bookings", { weeks: 8 });
  }
  revalidatePath("/clientes", "layout");
  revalidatePath("/agenda");
  revalidatePath("/");
  redirect(`/clientes/${clientId}?aba=dados`);
}

const slotSchema = z.object({
  weekday: z.coerce.number().int().min(0).max(6),
  hour: z.coerce.number().int().min(6).max(20),
  modalityId: z.string().uuid("Escolha a modalidade."),
});

export async function addRecurringSlot(clientId: string, formData: FormData): Promise<void> {
  const parsed = slotSchema.parse({ weekday: formData.get("weekday"), hour: formData.get("hour"), modalityId: formData.get("modality_id") });
  const supabase = await db();
  const { error } = await supabase.from("recurring_slots").insert({
    client_id: clientId,
    modality_id: parsed.modalityId,
    weekday: parsed.weekday,
    start_time: `${String(parsed.hour).padStart(2, "0")}:00`,
    active_from: todayISO(),
  });
  if (error) throw new Error(friendly(error));
  await supabase.rpc("generate_bookings", { weeks: 8 });
  revalidatePath(`/clientes/${clientId}`);
  revalidatePath("/agenda");
  revalidatePath("/");
}

export async function removeRecurringSlot(clientId: string, slotId: string): Promise<void> {
  const supabase = await db();
  // Future sessions generated from this slot disappear, unless they were already marked.
  await supabase.from("bookings").delete().eq("recurring_slot_id", slotId).gte("date", todayISO()).is("status", null);
  const { error } = await supabase.from("recurring_slots").delete().eq("id", slotId);
  if (error) throw new Error(friendly(error));
  revalidatePath(`/clientes/${clientId}`);
  revalidatePath("/agenda");
  revalidatePath("/");
}

// ---------------------------------------------------------------- evaluations and evolutions
//
// Both use the same tables for every modality: shared columns plus `data` (jsonb), validated against
// the modality's form definition (packages/forms). Unknown keys are rejected, never stored.

async function resolveModality(key: string): Promise<Modality | null> {
  if (!isModalityKey(key)) return null;
  return (await getModalities()).find((m) => m.key === key) ?? null;
}

function readData(formData: FormData, modality: ModalityKey, kind: "evaluation" | "evolution") {
  let raw: unknown;
  try {
    raw = JSON.parse(text(formData.get("data")) || "{}");
  } catch {
    return { error: "Não foi possível ler os campos do formulário." } as const;
  }
  const def = getForm(modality, kind);
  const parsed = parseData(def, raw);
  if (!parsed.ok) return { error: parsed.error } as const;
  return { def, data: parsed.data } as const;
}

export async function saveEvaluation(clientId: string, modalityKey: string, evaluationId: string | null, _prev: FormState, formData: FormData): Promise<FormState> {
  const date = text(formData.get("date"));
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return { error: "Informe a data." };
  const modality = await resolveModality(modalityKey);
  if (!modality) return { error: "Modalidade inválida." };
  const read = readData(formData, modality.key, "evaluation");
  if ("error" in read) return { error: read.error };

  try {
    const supabase = await db();
    const { error } = evaluationId
      ? await supabase.from("evaluations").update({ date, data: read.data, schema_version: read.def.schemaVersion }).eq("id", evaluationId).eq("client_id", clientId)
      : await supabase.from("evaluations").insert({ client_id: clientId, modality_id: modality.id, date, data: read.data, schema_version: read.def.schemaVersion });
    if (error) return { error: friendly(error) };
  } catch (e) {
    return { error: (e as Error).message };
  }
  revalidatePath(`/clientes/${clientId}`);
  return { saved: true };
}

export async function deleteEvaluation(clientId: string, evaluationId: string): Promise<void> {
  const supabase = await db();
  const { error } = await supabase.from("evaluations").delete().eq("id", evaluationId).eq("client_id", clientId);
  if (error) throw new Error(friendly(error));
  revalidatePath(`/clientes/${clientId}`);
}

export async function saveEvolution(clientId: string, modalityKey: string, evolutionId: string | null, _prev: FormState, formData: FormData): Promise<FormState> {
  const date = text(formData.get("date"));
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return { error: "Informe a data." };
  const bookingId = orNull(text(formData.get("booking_id")));
  const sessionNumber = Number.parseInt(text(formData.get("session_number")), 10);
  if (!Number.isInteger(sessionNumber) || sessionNumber < 1) return { error: "Informe o número da sessão." };
  const modality = await resolveModality(modalityKey);
  if (!modality) return { error: "Modalidade inválida." };
  const read = readData(formData, modality.key, "evolution");
  if ("error" in read) return { error: read.error };
  if (isEmptyData(read.def, read.data)) return { error: "Preencha ao menos um campo da evolução." };

  let savedId: string;
  try {
    const supabase = await db();
    if (evolutionId) {
      const { error } = await supabase
        .from("evolutions")
        .update({ date, booking_id: bookingId, session_number: sessionNumber, data: read.data, schema_version: read.def.schemaVersion })
        .eq("id", evolutionId)
        .eq("client_id", clientId);
      if (error) return { error: friendly(error) };
      savedId = evolutionId;
    } else {
      const { data, error } = await supabase
        .from("evolutions")
        .insert({ client_id: clientId, modality_id: modality.id, date, booking_id: bookingId, session_number: sessionNumber, data: read.data, schema_version: read.def.schemaVersion })
        .select("id")
        .single();
      if (error) return { error: friendly(error) };
      savedId = data.id as string;
    }
  } catch (e) {
    return { error: (e as Error).message };
  }
  revalidatePath(`/clientes/${clientId}`);
  revalidatePath("/");
  redirect(`/clientes/${clientId}/evolucoes/${savedId}?salvo=1`);
}

export async function deleteEvolution(clientId: string, evolutionId: string): Promise<void> {
  const supabase = await db();
  const { error } = await supabase.from("evolutions").delete().eq("id", evolutionId).eq("client_id", clientId);
  if (error) throw new Error(friendly(error));
  revalidatePath(`/clientes/${clientId}`);
  revalidatePath("/");
  redirect(`/clientes/${clientId}?aba=evolucoes`);
}

// ---------------------------------------------------------------- documents

const DOCUMENTS_BUCKET = "client-documents";
const MAX_DOCUMENT_BYTES = 10 * 1024 * 1024;
const ALLOWED_DOCUMENT_TYPES = new Set(["application/pdf", "image/jpeg", "image/png", "image/heic", "image/heif"]);

export async function uploadDocument(clientId: string, formData: FormData): Promise<void> {
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) throw new Error("Escolha um arquivo.");
  if (!ALLOWED_DOCUMENT_TYPES.has(file.type)) throw new Error("Formato não suportado. Envie PDF, JPG, PNG ou HEIC.");
  if (file.size > MAX_DOCUMENT_BYTES) throw new Error("O arquivo deve ter até 10MB.");

  const label = text(formData.get("name")) || file.name;
  const ext = file.name.includes(".") ? file.name.slice(file.name.lastIndexOf(".")) : "";
  const path = `${clientId}/${crypto.randomUUID()}${ext}`;

  const supabase = await db();
  const { error: uploadError } = await supabase.storage.from(DOCUMENTS_BUCKET).upload(path, file, { contentType: file.type });
  if (uploadError) throw new Error(friendly(uploadError));
  const { error } = await supabase.from("documents").insert({
    client_id: clientId,
    name: label,
    storage_path: path,
    mime_type: file.type,
    size_bytes: file.size,
  });
  if (error) {
    await supabase.storage.from(DOCUMENTS_BUCKET).remove([path]);
    throw new Error(friendly(error));
  }
  revalidatePath(`/clientes/${clientId}`);
  redirect(`/clientes/${clientId}?aba=dados`);
}

export async function deleteDocument(clientId: string, documentId: string): Promise<void> {
  const supabase = await db();
  const { data: doc, error: findError } = await supabase.from("documents").select("storage_path").eq("id", documentId).eq("client_id", clientId).maybeSingle();
  if (findError) throw new Error(friendly(findError));
  if (doc) {
    await supabase.storage.from(DOCUMENTS_BUCKET).remove([doc.storage_path as string]);
    const { error } = await supabase.from("documents").delete().eq("id", documentId).eq("client_id", clientId);
    if (error) throw new Error(friendly(error));
  }
  revalidatePath(`/clientes/${clientId}`);
  redirect(`/clientes/${clientId}?aba=dados`);
}
