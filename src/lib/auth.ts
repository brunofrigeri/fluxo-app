import { createClient } from "@/lib/supabase/server";

/** A Supabase client for a signed-in admin. Throws when the session is gone. */
export async function db() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Sessão expirada. Entre novamente.");
  return supabase;
}

/** Friendly messages for the Postgres errors users can actually trigger. */
export function friendly(error: { code?: string; message: string }): string {
  if (error.code === "23505") {
    if (error.message.includes("document")) return "Já existe um cliente com este documento.";
    if (error.message.includes("replaces_booking_id") || error.message.includes("one_replacement")) return "Esta falta já foi reposta.";
    return "Este cliente já está neste horário.";
  }
  if (error.code === "23514") {
    if (error.message.includes("bookings_justified_needs_reason")) return "Informe o motivo da falta justificada.";
    if (error.message.includes("bookings_check")) return "Esta sessão é uma reposição e não pode mudar de status.";
    return error.message;
  }
  return error.message;
}
