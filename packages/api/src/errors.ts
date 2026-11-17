/** What every mutation returns: nothing on success, a pt-BR message on failure. */
export type Result = { error?: string };

/** Friendly messages for the Postgres errors users can actually trigger. */
export function friendly(error: { code?: string; message: string }): string {
  if (error.code === "23505") {
    if (error.message.includes("document")) return "Já existe um cliente com este documento.";
    if (error.message.includes("replaces_booking_id") || error.message.includes("one_replacement")) return "Esta falta já foi reposta.";
    return "Este cliente já está neste horário.";
  }
  if (error.code === "42501" || error.message.includes("row-level security")) return "Você não tem acesso a esta modalidade deste cliente.";
  if (error.code === "23514") {
    if (error.message.includes("bookings_justified_needs_reason")) return "Informe o motivo da falta justificada.";
    if (error.message.includes("bookings_check")) return "Esta sessão é uma reposição e não pode mudar de status.";
    return error.message;
  }
  return error.message;
}

/** Runs a mutation and turns anything it throws (network down, expired session) into a `Result`. */
export async function attempt(fn: () => Promise<Result>): Promise<Result> {
  try {
    return await fn();
  } catch (e) {
    return { error: e instanceof Error ? e.message : String(e) };
  }
}

export const NOT_ALLOWED = "Não foi possível alterar: o registro não existe ou você não tem acesso a ele.";

/**
 * RLS hides rows the user cannot see, so an update or delete on one "succeeds" while touching nothing. Ask for the
 * affected rows back (`.select("id")`) and pass them here: no rows means the change did not happen.
 */
export function touched(data: unknown): boolean {
  return Array.isArray(data) && data.length > 0;
}
