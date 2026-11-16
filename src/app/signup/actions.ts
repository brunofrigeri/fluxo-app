"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

const schema = z.object({
  name: z.string().min(2, "Informe o nome."),
  email: z.string().email("E-mail inválido."),
  password: z.string().min(8, "A senha deve ter pelo menos 8 caracteres."),
});

/**
 * Self-signup: creates the auth user only. The new studio + admin profile are provisioned
 * on first authenticated page load (see ensureProfile in lib/admin.ts) — needed either way,
 * since if the Supabase project requires email confirmation there's no session yet to act on.
 */
export async function signUp(formData: FormData): Promise<void> {
  const parsed = schema.safeParse({
    name: String(formData.get("name") ?? "").trim(),
    email: String(formData.get("email") ?? "").trim(),
    password: String(formData.get("password") ?? ""),
  });
  if (!parsed.success) redirect(`/signup?erro=${encodeURIComponent(parsed.error.issues[0].message)}`);

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: { data: { full_name: parsed.data.name } },
  });
  if (error) {
    const message = error.message.toLowerCase().includes("already registered") ? "Já existe uma conta com este e-mail." : error.message;
    redirect(`/signup?erro=${encodeURIComponent(message)}`);
  }
  if (!data.session) redirect("/signup?confirme=1");
  redirect("/");
}
