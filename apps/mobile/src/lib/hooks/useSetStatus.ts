import { setBookingStatus, type AgendaBooking, type HomeData } from "@fluxo/api";
import type { AttendanceStatus } from "@fluxo/domain";
import { useMutation, useQueryClient, type QueryKey } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useToast } from "@/lib/toast";

type Vars = { bookingId: string; status: AttendanceStatus | null; reason?: string | null };
type Snapshot = [QueryKey, unknown][];

/**
 * Marks attendance. Optimistic: the cached Home and Agenda data are patched before the request leaves, so the chip
 * changes on the tap. If the server refuses (a replacement cannot change status, access lost...), the previous data
 * is put back and a toast says why. The caches are refetched afterwards either way.
 */
export function useSetStatus() {
  const qc = useQueryClient();
  const toast = useToast();

  return useMutation({
    mutationFn: async ({ bookingId, status, reason }: Vars) => {
      const r = await setBookingStatus(supabase, bookingId, status, reason);
      if (r.error) throw new Error(r.error);
    },
    onMutate: async ({ bookingId, status, reason }) => {
      await Promise.all([qc.cancelQueries({ queryKey: ["home"] }), qc.cancelQueries({ queryKey: ["agenda"] })]);
      const snapshot: Snapshot = [...qc.getQueriesData({ queryKey: ["home"] }), ...qc.getQueriesData({ queryKey: ["agenda"] })];
      const missReason = status === "JUSTIFIED_MISS" ? (reason?.trim() ?? null) : null;

      qc.setQueriesData<HomeData>({ queryKey: ["home"] }, (data) =>
        data && {
          ...data,
          slots: data.slots.map((s) => ({ ...s, clients: s.clients.map((c) => (c.bookingId === bookingId ? { ...c, status, missReason } : c)) })),
          // a session marked now no longer waits for attendance
          unmarked: status === null ? data.unmarked : data.unmarked.filter((p) => p.bookingId !== bookingId),
        },
      );
      qc.setQueriesData<AgendaBooking[]>({ queryKey: ["agenda"] }, (data) => data?.map((b) => (b.id === bookingId ? { ...b, status, missReason } : b)));
      return { snapshot };
    },
    onError: (error, _vars, ctx) => {
      for (const [key, data] of ctx?.snapshot ?? []) qc.setQueryData(key, data);
      toast(error.message);
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ["home"] });
      qc.invalidateQueries({ queryKey: ["agenda"] });
    },
  });
}
