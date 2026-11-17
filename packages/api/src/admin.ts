import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { attempt, friendly, NOT_ALLOWED, touched, type Result } from "./errors";
import { getStudioModalities } from "./modalities";
import type { Me, Role } from "./profile";

// ---------------------------------------------------------------- studio settings

/** Switches a modality on or off for the studio. Admins only (the owner, once ownership exists). */
export function setStudioModality(supabase: SupabaseClient, me: Pick<Me, "role" | "studioId">, modalityId: string, enabled: boolean): Promise<Result> {
  return attempt(async () => {
    if (!z.string().uuid().safeParse(modalityId).success) return { error: "Modalidade inválida." };
    if (!me.studioId) return { error: "Sessão expirada. Entre novamente." };
    if (me.role !== "admin") return { error: "Apenas administradores alteram as modalidades do estúdio." };
    const { error } = enabled
      ? await supabase.from("studio_modalities").insert({ studio_id: me.studioId, modality_id: modalityId })
      : await supabase.from("studio_modalities").delete().eq("studio_id", me.studioId).eq("modality_id", modalityId);
    // 23505: already on. Switching on twice is not an error.
    if (error && error.code !== "23505") return { error: friendly(error) };
    return {};
  });
}

// ---------------------------------------------------------------- users

export type UserItem = { id: string; name: string; email: string; role: Role; workingHours: string | null; modalityIds: string[] };

/** Everyone in the studio (admins only: RLS returns just yourself to anyone else). */
export async function listUsers(supabase: SupabaseClient): Promise<UserItem[]> {
  const [{ data, error }, taught] = await Promise.all([supabase.from("profiles").select("id, name, email, role, working_hours").order("name"), supabase.from("user_modalities").select("user_id, modality_id")]);
  if (error) throw new Error(`usuários: ${error.message}`);
  if (taught.error) throw new Error(`modalidades dos usuários: ${taught.error.message}`);
  return (data ?? []).map((u) => ({
    id: u.id as string,
    name: u.name as string,
    email: u.email as string,
    role: u.role === "admin" ? "admin" : "instructor",
    workingHours: (u.working_hours as string | null) ?? null,
    modalityIds: (taught.data ?? []).filter((t) => t.user_id === u.id).map((t) => t.modality_id as string),
  }));
}

export type UserInput = { name: string; role: string; workingHours: string | null; modalityIds: string[] };

export const userSchema = z.object({
  name: z.string().min(2, "Informe o nome."),
  role: z.enum(["admin", "instructor"], { message: "Escolha um papel." }),
  working_hours: z.string().nullable(),
});

/** The modalities ticked on the form, checked against what the studio offers. */
export async function checkTaughtModalities(supabase: SupabaseClient, ids: string[], role: Role): Promise<string[] | string> {
  const offered = new Set((await getStudioModalities(supabase)).map((m) => m.id));
  const unique = [...new Set(ids)];
  if (unique.some((id) => !offered.has(id))) return "Modalidade inválida.";
  if (role === "instructor" && unique.length === 0) return "Escolha ao menos uma modalidade que o instrutor ensina.";
  return unique;
}

/** Makes the modalities a user teaches exactly `ids` (works with either the RLS-scoped or the admin client). */
export async function syncUserModalities(client: SupabaseClient, userId: string, ids: string[]) {
  const del = client.from("user_modalities").delete().eq("user_id", userId);
  const { error: removeError } = ids.length > 0 ? await del.not("modality_id", "in", `(${ids.join(",")})`) : await del;
  if (removeError) return { error: removeError };
  if (ids.length === 0) return { error: null };
  return client.from("user_modalities").upsert(ids.map((modality_id) => ({ user_id: userId, modality_id })), { onConflict: "user_id,modality_id", ignoreDuplicates: true });
}

/** Admin-only edit of a person in the studio. Stopping a modality is refused while they still own clients in it. */
export function updateUser(supabase: SupabaseClient, me: Pick<Me, "role">, userId: string, input: UserInput): Promise<Result> {
  return attempt(async () => {
    if (me.role !== "admin") return { error: "Apenas administradores podem gerenciar usuários." };
    const parsed = userSchema.safeParse({ name: input.name.trim(), role: input.role, working_hours: input.workingHours?.trim() ? input.workingHours.trim() : null });
    if (!parsed.success) return { error: parsed.error.issues[0].message };
    const taught = await checkTaughtModalities(supabase, input.modalityIds, parsed.data.role);
    if (typeof taught === "string") return { error: taught };

    const { data: current, error: currentError } = await supabase.from("user_modalities").select("modality_id").eq("user_id", userId);
    if (currentError) return { error: friendly(currentError) };
    const had = new Set((current ?? []).map((r) => r.modality_id as string));
    const want = new Set(taught);
    const removed = [...had].filter((id) => !want.has(id));

    // Stopping a modality would silently leave their clients without an instructor: make the admin reassign first.
    if (removed.length > 0) {
      const { count, error: countError } = await supabase.from("client_modality_instructors").select("client_id", { count: "exact", head: true }).eq("instructor_id", userId).in("modality_id", removed);
      if (countError) return { error: friendly(countError) };
      if ((count ?? 0) > 0) return { error: `Esta pessoa é responsável por ${count} ${count === 1 ? "cliente" : "clientes"} nessa modalidade. Reatribua antes de removê-la.` };
    }

    const { data, error } = await supabase.from("profiles").update(parsed.data).eq("id", userId).select("id");
    if (error) return { error: friendly(error) };
    if (!touched(data)) return { error: NOT_ALLOWED };
    // Becoming an admin adds every studio modality (migration 0012); make it exactly what was ticked.
    const { error: syncError } = await syncUserModalities(supabase, userId, [...want]);
    return syncError ? { error: friendly(syncError) } : {};
  });
}
