"use server";

import { revalidatePath } from "next/cache";
import { getAdmin } from "@/lib/admin";
import { db, friendly } from "@/lib/auth";
import { waitSchema } from "@/lib/waitlist";

export type WaitState = { error?: string; saved?: number } | undefined;

function read(formData: FormData) {
  return waitSchema.safeParse({
    name: String(formData.get("name") ?? ""),
    phone: String(formData.get("phone") ?? ""),
    period: String(formData.get("period") ?? ""),
    modalityId: String(formData.get("modality_id") ?? ""),
  });
}

export async function addToWaitList(_prev: WaitState, formData: FormData): Promise<WaitState> {
  const parsed = read(formData);
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  try {
    const me = await getAdmin();
    if (!me?.studioId) return { error: "Sessão expirada. Entre novamente." };
    const supabase = await db();
    const { modalityId, ...rest } = parsed.data;
    const { error } = await supabase.from("wait_list").insert({ ...rest, modality_id: modalityId, studio_id: me.studioId });
    if (error) return { error: friendly(error) };
  } catch (e) {
    return { error: (e as Error).message };
  }
  revalidatePath("/espera");
  return { saved: Date.now() };
}

export async function updateWaitEntry(id: string, _prev: WaitState, formData: FormData): Promise<WaitState> {
  const parsed = read(formData);
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  try {
    const supabase = await db();
    const { modalityId, ...rest } = parsed.data;
    const { error } = await supabase.from("wait_list").update({ ...rest, modality_id: modalityId }).eq("id", id);
    if (error) return { error: friendly(error) };
  } catch (e) {
    return { error: (e as Error).message };
  }
  revalidatePath("/espera");
  return { saved: Date.now() }; // the dialog closes itself; no redirect, so the page stays put
}

export async function removeFromWaitList(id: string): Promise<void> {
  const supabase = await db();
  const { error } = await supabase.from("wait_list").delete().eq("id", id);
  if (error) throw new Error(friendly(error));
  revalidatePath("/espera");
}
