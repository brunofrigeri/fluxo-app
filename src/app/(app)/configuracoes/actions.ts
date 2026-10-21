"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getAdmin } from "@/lib/admin";
import { db, friendly } from "@/lib/auth";

type Result = { error?: string };

/** Switches a modality on or off for the studio. Admins only (the owner, once ownership exists). */
export async function setStudioModality(modalityId: string, enabled: boolean): Promise<Result> {
  if (!z.string().uuid().safeParse(modalityId).success) return { error: "Modalidade inválida." };
  try {
    const me = await getAdmin();
    if (!me?.studioId) return { error: "Sessão expirada. Entre novamente." };
    if (me.role !== "admin") return { error: "Apenas administradores alteram as modalidades do estúdio." };
    const supabase = await db();
    const { error } = enabled
      ? await supabase.from("studio_modalities").insert({ studio_id: me.studioId, modality_id: modalityId })
      : await supabase.from("studio_modalities").delete().eq("studio_id", me.studioId).eq("modality_id", modalityId);
    if (error && error.code !== "23505") return { error: friendly(error) };
  } catch (e) {
    return { error: (e as Error).message };
  }
  // Only the pages that list modalities; never the whole layout (keeps the background refresh small).
  for (const path of ["/configuracoes", "/usuarios", "/agenda", "/clientes", "/espera", "/"]) revalidatePath(path);
  return {};
}
