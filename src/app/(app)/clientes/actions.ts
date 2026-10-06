"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { cleanTree } from "@/lib/apparatus";
import { db, friendly } from "@/lib/auth";
import { todayISO } from "@/lib/dates";

export type FormState = { error?: string } | undefined;

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
  });
}

export async function createClientAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = readClient(formData);
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  let id: string;
  try {
    const supabase = await db();
    const { data, error } = await supabase.from("clients").insert(parsed.data).select("id").single();
    if (error) return { error: friendly(error) };
    id = data.id as string;
  } catch (e) {
    return { error: (e as Error).message };
  }
  revalidatePath("/clientes");
  redirect(`/clientes/${id}?aba=dados`);
}

export async function updateClientAction(clientId: string, _prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = readClient(formData);
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const list = (key: string) => formData.getAll(key).map((v) => String(v).trim()).filter(Boolean);
  try {
    const supabase = await db();
    const { error } = await supabase
      .from("clients")
      .update({ ...parsed.data, diseases: list("diseases"), surgeries: list("surgeries") })
      .eq("id", clientId);
    if (error) return { error: friendly(error) };
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
});

export async function addRecurringSlot(clientId: string, formData: FormData): Promise<void> {
  const parsed = slotSchema.parse({ weekday: formData.get("weekday"), hour: formData.get("hour") });
  const supabase = await db();
  const { error } = await supabase.from("recurring_slots").insert({
    client_id: clientId,
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

// ---------------------------------------------------------------- evaluations

const evaluationSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Informe a data."),
  main_complaint: z.string().nullable(),
  diagnosis: z.string().nullable(),
  hdp: z.string().nullable(),
  hda: z.string().nullable(),
  medications: z.string().nullable(),
  movement_restrictions: z.string().nullable(),
  obs: z.string().nullable(),
});

export async function saveEvaluation(clientId: string, evaluationId: string | null, _prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = evaluationSchema.safeParse({
    date: text(formData.get("date")),
    main_complaint: orNull(text(formData.get("main_complaint"))),
    diagnosis: orNull(text(formData.get("diagnosis"))),
    hdp: orNull(text(formData.get("hdp"))),
    hda: orNull(text(formData.get("hda"))),
    medications: orNull(text(formData.get("medications"))),
    movement_restrictions: orNull(text(formData.get("movement_restrictions"))),
    obs: orNull(text(formData.get("obs"))),
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  try {
    const supabase = await db();
    const { error } = evaluationId
      ? await supabase.from("evaluations").update(parsed.data).eq("id", evaluationId).eq("client_id", clientId)
      : await supabase.from("evaluations").insert({ ...parsed.data, client_id: clientId });
    if (error) return { error: friendly(error) };
  } catch (e) {
    return { error: (e as Error).message };
  }
  revalidatePath(`/clientes/${clientId}`);
  redirect(`/clientes/${clientId}?aba=avaliacoes`);
}

export async function deleteEvaluation(clientId: string, evaluationId: string): Promise<void> {
  const supabase = await db();
  const { error } = await supabase.from("evaluations").delete().eq("id", evaluationId).eq("client_id", clientId);
  if (error) throw new Error(friendly(error));
  revalidatePath(`/clientes/${clientId}`);
  redirect(`/clientes/${clientId}?aba=avaliacoes`);
}

// ---------------------------------------------------------------- evolutions

export async function saveEvolution(clientId: string, evolutionId: string | null, _prev: FormState, formData: FormData): Promise<FormState> {
  const date = text(formData.get("date"));
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return { error: "Informe a data." };
  const bookingId = orNull(text(formData.get("booking_id")));

  let tree;
  try {
    tree = cleanTree(JSON.parse(text(formData.get("apparatus")) || "{}"));
  } catch {
    return { error: "Não foi possível ler os campos da evolução." };
  }
  if (Object.keys(tree).length === 0) return { error: "Preencha ao menos um campo da evolução." };

  let savedId: string;
  try {
    const supabase = await db();
    if (evolutionId) {
      const { error } = await supabase
        .from("evolutions")
        .update({ date, booking_id: bookingId, apparatus: tree })
        .eq("id", evolutionId)
        .eq("client_id", clientId);
      if (error) return { error: friendly(error) };
      savedId = evolutionId;
    } else {
      const { data, error } = await supabase
        .from("evolutions")
        .insert({ client_id: clientId, date, booking_id: bookingId, apparatus: tree })
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
