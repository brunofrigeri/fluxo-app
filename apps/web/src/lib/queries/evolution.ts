// Web adapter over @fluxo/api: binds the per-request, cookie-based Supabase client.
import * as api from "@fluxo/api";
import { createClient } from "@/lib/supabase/server";

export type { ClientHead, SessionOption } from "@fluxo/api";

export async function getClientHead(clientId: string) {
  return api.getClientHead(await createClient(), clientId);
}

/** Sessions of this modality where the client was present (or made a replacement) that have no evolution yet. */
export async function getSessionOptions(clientId: string, modalityId: string, keepBookingId?: string | null) {
  return api.getSessionOptions(await createClient(), clientId, modalityId, keepBookingId);
}

/** The modalities a client is enrolled in that the signed-in user can see (RLS: an instructor sees only their own). */
export async function getClientModalities(clientId: string) {
  return api.getClientModalities(await createClient(), clientId);
}

/** How many evolutions the client already has in a modality: the next session number is this plus one. */
export async function countEvolutions(clientId: string, modalityId: string) {
  return api.countEvolutions(await createClient(), clientId, modalityId);
}
