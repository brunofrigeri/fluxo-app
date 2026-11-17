import { cache } from "react";
import * as api from "@fluxo/api";
import type { Admin } from "@/lib/admin";
import { createClient } from "@/lib/supabase/server";

// Web adapter over @fluxo/api: binds the per-request, cookie-based Supabase client and memoizes per render.
export type { Modality, Instructor } from "@fluxo/api";
export { pickModality } from "@fluxo/api";

/** Every modality Fluxo ships (the seed table). Rows with a key this build does not know are skipped. */
export const getModalities = cache(async () => api.getModalities(await createClient()));

/** The modalities the signed-in user's studio has switched on. */
export const getStudioModalities = cache(async () => api.getStudioModalities(await createClient()));

/**
 * The modalities this user can schedule and assign clients in: an instructor, the ones they teach;
 * an admin manages the whole studio, so every modality the studio offers.
 */
export async function getTeachableModalities(me: Pick<Admin, "id" | "role">) {
  return api.getTeachableModalities(await createClient(), me);
}

/** Who teaches what, for the "responsible instructor" pickers. Admins see the whole studio; anyone else only themselves. */
export async function getInstructorsByModality() {
  return api.getInstructorsByModality(await createClient());
}
