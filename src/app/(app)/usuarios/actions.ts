"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db, friendly } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";

export type FormState = { error?: string } | undefined;

const text = (v: FormDataEntryValue | null) => String(v ?? "").trim();
const orNull = (v: string) => (v === "" ? null : v);

async function requireAdmin() {
  const supabase = await db();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Sessão expirada. Entre novamente.");
  const { data: profile } = await supabase.from("profiles").select("role, studio_id").eq("id", user.id).maybeSingle();
  if (profile?.role !== "admin") throw new Error("Apenas administradores podem gerenciar usuários.");
  return { supabase, userId: user.id as string, studioId: profile.studio_id as string };
}

const inviteSchema = z.object({
  name: z.string().min(2, "Informe o nome."),
  email: z.string().email("E-mail inválido."),
  role: z.enum(["admin", "instructor"], { message: "Escolha um papel." }),
  working_hours: z.string().nullable(),
});

/** Sends a Supabase invite email and creates the profile row once admin privileges are confirmed. */
export async function inviteUser(_prev: FormState, formData: FormData): Promise<FormState> {
  const { studioId } = await requireAdmin();
  const parsed = inviteSchema.safeParse({
    name: text(formData.get("name")),
    email: text(formData.get("email")),
    role: text(formData.get("role")),
    working_hours: orNull(text(formData.get("working_hours"))),
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  try {
    const h = await headers();
    const origin = h.get("origin") ?? `https://${h.get("host")}`;
    const admin = createAdminClient();
    const { data, error } = await admin.auth.admin.inviteUserByEmail(parsed.data.email, {
      data: { full_name: parsed.data.name },
      redirectTo: `${origin}/convite`,
    });
    if (error) return { error: error.message.toLowerCase().includes("already registered") ? "Já existe uma conta com este e-mail." : error.message };
    const userId = data.user.id;
    const { error: profileError } = await admin.from("profiles").insert({
      id: userId,
      email: parsed.data.email,
      name: parsed.data.name,
      role: parsed.data.role,
      working_hours: parsed.data.working_hours,
      studio_id: studioId,
    });
    if (profileError) {
      await admin.auth.admin.deleteUser(userId);
      return { error: friendly(profileError) };
    }
  } catch (e) {
    return { error: (e as Error).message };
  }
  revalidatePath("/usuarios");
  redirect("/usuarios");
}

const updateSchema = z.object({
  name: z.string().min(2, "Informe o nome."),
  role: z.enum(["admin", "instructor"], { message: "Escolha um papel." }),
  working_hours: z.string().nullable(),
});

export async function updateUser(userId: string, _prev: FormState, formData: FormData): Promise<FormState> {
  const { supabase } = await requireAdmin();
  const parsed = updateSchema.safeParse({
    name: text(formData.get("name")),
    role: text(formData.get("role")),
    working_hours: orNull(text(formData.get("working_hours"))),
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const { error } = await supabase.from("profiles").update(parsed.data).eq("id", userId);
  if (error) return { error: friendly(error) };
  revalidatePath("/usuarios");
  redirect("/usuarios");
}

export async function removeUser(userId: string): Promise<void> {
  const { supabase, userId: adminId } = await requireAdmin();
  if (adminId === userId) throw new Error("Você não pode remover a própria conta.");
  // The admin client below bypasses RLS entirely, so confirm studio membership through the
  // RLS-scoped client first — this only returns a row when userId is in the admin's own studio.
  const { data: target } = await supabase.from("profiles").select("id").eq("id", userId).maybeSingle();
  if (!target) throw new Error("Usuário não encontrado.");
  const admin = createAdminClient();
  const { error } = await admin.auth.admin.deleteUser(userId);
  if (error) throw new Error(error.message);
  revalidatePath("/usuarios");
  revalidatePath("/clientes", "layout");
  redirect("/usuarios");
}
