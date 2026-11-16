"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import * as api from "@fluxo/api";
import { db } from "@/lib/auth";
import { inviteUserServer, removeUserServer, requireAdmin } from "@/lib/users-server";

/** `saved` tells the dialog to close itself; the actions do not redirect, so the page stays where it is. */
export type FormState = { error?: string; saved?: boolean } | undefined;

const text = (v: FormDataEntryValue | null) => String(v ?? "").trim();
const orNull = (v: string) => (v === "" ? null : v);

function readInput(formData: FormData): api.UserInput {
  return { name: text(formData.get("name")), role: text(formData.get("role")), workingHours: orNull(text(formData.get("working_hours"))), modalityIds: formData.getAll("modality").map(String) };
}

/** Sends a Supabase invite email and creates the profile row once admin privileges are confirmed. */
export async function inviteUser(_prev: FormState, formData: FormData): Promise<FormState> {
  let r: api.Result;
  try {
    const h = await headers();
    const origin = h.get("origin") ?? `https://${h.get("host")}`;
    r = await inviteUserServer(await db(), { ...readInput(formData), email: text(formData.get("email")) }, origin);
  } catch (e) {
    return { error: (e as Error).message };
  }
  if (r.error) return { error: r.error };
  revalidatePath("/usuarios");
  return { saved: true };
}

export async function updateUser(userId: string, _prev: FormState, formData: FormData): Promise<FormState> {
  try {
    const supabase = await db();
    const who = await requireAdmin(supabase);
    if ("error" in who) return { error: who.error };
    const r = await api.updateUser(supabase, { role: "admin" }, userId, readInput(formData));
    if (r.error) return { error: r.error };
  } catch (e) {
    return { error: (e as Error).message };
  }
  revalidatePath("/usuarios");
  return { saved: true };
}

export async function removeUser(userId: string): Promise<void> {
  const r = await removeUserServer(await db(), userId);
  if (r.error) throw new Error(r.error);
  revalidatePath("/usuarios");
  revalidatePath("/clientes", "layout");
  redirect("/usuarios");
}
