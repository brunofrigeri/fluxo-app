"use server";

import { revalidatePath } from "next/cache";
import * as api from "@fluxo/api";
import { getAdmin } from "@/lib/admin";
import { db } from "@/lib/auth";

export type WaitState = { error?: string; saved?: number } | undefined;

function read(formData: FormData): api.WaitInput {
  return {
    name: String(formData.get("name") ?? ""),
    phone: String(formData.get("phone") ?? ""),
    period: String(formData.get("period") ?? ""),
    modalityId: String(formData.get("modality_id") ?? ""),
  };
}

async function run(fn: (supabase: Awaited<ReturnType<typeof db>>) => Promise<api.Result>): Promise<api.Result> {
  try {
    const r = await fn(await db());
    if (!r.error) revalidatePath("/espera");
    return r;
  } catch (e) {
    return { error: (e as Error).message };
  }
}

export async function addToWaitList(_prev: WaitState, formData: FormData): Promise<WaitState> {
  const me = await getAdmin();
  const r = await run((s) => api.addToWaitList(s, me?.studioId ?? null, read(formData)));
  return r.error ? { error: r.error } : { saved: Date.now() };
}

export async function updateWaitEntry(id: string, _prev: WaitState, formData: FormData): Promise<WaitState> {
  const r = await run((s) => api.updateWaitEntry(s, id, read(formData)));
  return r.error ? { error: r.error } : { saved: Date.now() }; // the dialog closes itself; no redirect, so the page stays put
}

export async function removeFromWaitList(id: string): Promise<void> {
  const r = await run((s) => api.removeFromWaitList(s, id));
  if (r.error) throw new Error(r.error);
}
