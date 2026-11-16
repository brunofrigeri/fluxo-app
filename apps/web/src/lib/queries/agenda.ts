// Web adapter over @fluxo/api: binds the per-request, cookie-based Supabase client. Logic lives in the package.
import * as api from "@fluxo/api";
import { createClient } from "@/lib/supabase/server";

export { VIEWS, FIRST_HOUR, LAST_HOUR, parseView, rangeFor, modalityKeyOf, monthCellLabel, formatDayMonth } from "@fluxo/api";
export type { View, AgendaBooking, AgendaRange, DialogClient } from "@fluxo/api";

export async function getAgendaBookings(from: string, to: string, modalityId?: string | null) {
  return api.getAgendaBookings(await createClient(), from, to, modalityId);
}

export async function getDialogClients() {
  return api.getDialogClients(await createClient());
}
