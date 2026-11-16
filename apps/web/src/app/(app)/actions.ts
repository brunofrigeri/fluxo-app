"use server";

// Server actions for the agenda and home. The rules and queries live in @fluxo/api (shared with the mobile app);
// each action here only checks the session, calls it, and revalidates the pages that show the data.

import { revalidatePath } from "next/cache";
import * as api from "@fluxo/api";
import { getAdmin } from "@/lib/admin";
import { db } from "@/lib/auth";
import { getDialogClients, type DialogClient } from "@/lib/queries/agenda";
import type { AttendanceStatus } from "@/lib/status";

type Result = api.Result;

function refresh() {
  revalidatePath("/");
  revalidatePath("/agenda");
  revalidatePath("/clientes", "layout");
}

/** Runs a mutation with the signed-in user's client; a gone session becomes an error message, not a crash. */
async function mutate(fn: (supabase: Awaited<ReturnType<typeof db>>) => Promise<Result>): Promise<Result> {
  let result: Result;
  try {
    result = await fn(await db());
  } catch (e) {
    return { error: (e as Error).message };
  }
  if (!result.error) refresh();
  return result;
}

/** A justified miss needs a reason. Every other status clears it. */
export async function setBookingStatus(bookingId: string, status: AttendanceStatus | null, reason?: string | null): Promise<Result> {
  return mutate((s) => api.setBookingStatus(s, bookingId, status, reason));
}

export async function deleteBooking(bookingId: string): Promise<Result> {
  return mutate((s) => api.deleteBooking(s, bookingId));
}

/**
 * Adds a client to a slot, in a modality, or as a labelled one-off entry (`label`, no modality and
 * no evolution form). With `replacesId` it is a replacement for that justified miss.
 */
export async function createBooking(input: api.NewBooking): Promise<Result> {
  return mutate((s) => api.createBooking(s, input));
}

/** Active clients with their pending justified misses, fetched on demand when the add-booking dialog opens. */
export async function getDialogClientsAction(): Promise<DialogClient[]> {
  return getDialogClients();
}

/** A shared note for a class slot (date + hour + modality), independent of any one client. */
export async function getSessionNote(date: string, hour: number, modalityId: string): Promise<string | null> {
  try {
    return await api.getSessionNote(await db(), date, hour, modalityId);
  } catch {
    return null;
  }
}

export async function saveSessionNote(date: string, hour: number, modalityId: string, note: string): Promise<Result> {
  return mutate(async (s) => {
    const me = await getAdmin();
    return api.saveSessionNote(s, me?.studioId ?? null, date, hour, modalityId, note);
  });
}

/** Latest evolution of a client in one modality, for the agenda popover. */
export async function getLastEvolution(clientId: string, modalityId: string): Promise<{ date: string; title: string; text: string } | null> {
  try {
    return await api.getLastEvolution(await db(), clientId, modalityId);
  } catch {
    return null;
  }
}
