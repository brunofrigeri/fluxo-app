// Web adapter over @fluxo/api: binds the per-request, cookie-based Supabase client. Logic lives in the package.
import * as api from "@fluxo/api";
import { createClient } from "@/lib/supabase/server";

export type { SlotClient, Slot, Pending, Attention, Birthday, HomeData } from "@fluxo/api";

export async function getHomeData(modalityId?: string | null) {
  return api.getHomeData(await createClient(), modalityId);
}
