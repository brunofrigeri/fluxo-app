"use server";

import { revalidatePath } from "next/cache";
import * as api from "@fluxo/api";
import { getAdmin } from "@/lib/admin";
import { db } from "@/lib/auth";

type Result = api.Result;

/** Switches a modality on or off for the studio. Admins only (the owner, once ownership exists). */
export async function setStudioModality(modalityId: string, enabled: boolean): Promise<Result> {
  let result: Result;
  try {
    const me = await getAdmin();
    result = await api.setStudioModality(await db(), { role: me?.role ?? "instructor", studioId: me?.studioId ?? null }, modalityId, enabled);
  } catch (e) {
    return { error: (e as Error).message };
  }
  if (result.error) return result;
  // Only the pages that list modalities; never the whole layout (keeps the background refresh small).
  for (const path of ["/configuracoes", "/usuarios", "/agenda", "/clientes", "/espera", "/"]) revalidatePath(path);
  return {};
}
