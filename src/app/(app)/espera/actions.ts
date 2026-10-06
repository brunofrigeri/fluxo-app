"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db, friendly } from "@/lib/auth";
import { waitSchema } from "@/lib/waitlist";

export type WaitState = { error?: string; saved?: number } | undefined;

function read(formData: FormData) {
  return waitSchema.safeParse({
    name: String(formData.get("name") ?? ""),
    phone: String(formData.get("phone") ?? ""),
    period: String(formData.get("period") ?? ""),
  });
}

export async function addToWaitList(_prev: WaitState, formData: FormData): Promise<WaitState> {
  const parsed = read(formData);
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  try {
    const supabase = await db();
    const { error } = await supabase.from("wait_list").insert(parsed.data);
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
    const { error } = await supabase.from("wait_list").update(parsed.data).eq("id", id);
    if (error) return { error: friendly(error) };
  } catch (e) {
    return { error: (e as Error).message };
  }
  revalidatePath("/espera");
  redirect("/espera");
}

export async function removeFromWaitList(id: string): Promise<void> {
  const supabase = await db();
  const { error } = await supabase.from("wait_list").delete().eq("id", id);
  if (error) throw new Error(friendly(error));
  revalidatePath("/espera");
}
