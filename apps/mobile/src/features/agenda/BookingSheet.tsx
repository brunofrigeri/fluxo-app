import { deleteBooking, getLastEvolution, type AgendaBooking } from "@fluxo/api";
import { formatDayMonth, formatWeekdayDate, isPresent } from "@fluxo/domain";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { Alert, View } from "react-native";
import { useSetStatus } from "@/lib/hooks/useSetStatus";
import { supabase } from "@/lib/supabase";
import { useToast } from "@/lib/toast";
import { Avatar } from "@/ui/Avatar";
import { Button } from "@/ui/Button";
import { Card } from "@/ui/Card";
import { ModalityTag } from "@/ui/ModalityTag";
import { Sheet } from "@/ui/Sheet";
import { StatusPicker } from "@/ui/StatusSheet";
import { Text } from "@/ui/Text";

/** One client in a slot: set attendance, see the latest evolution, jump to the client or write an evolution. */
export function BookingSheet({ booking, onClose, isAdmin }: { booking: AgendaBooking | null; onClose: () => void; isAdmin: boolean }) {
  const router = useRouter();
  const qc = useQueryClient();
  const toast = useToast();
  const setStatus = useSetStatus();

  const last = useQuery({
    queryKey: ["last-evolution", booking?.clientId, booking?.modalityId],
    enabled: !!booking?.modalityId,
    queryFn: () => getLastEvolution(supabase, booking!.clientId, booking!.modalityId!),
  });

  // Optimistic: the slot loses the client at once; the booking comes back with a message if the server refuses.
  const remove = useMutation({
    mutationFn: async (id: string) => {
      const r = await deleteBooking(supabase, id);
      if (r.error) throw new Error(r.error);
    },
    onMutate: async (id) => {
      await qc.cancelQueries({ queryKey: ["agenda"] });
      const snapshot = qc.getQueriesData<AgendaBooking[]>({ queryKey: ["agenda"] });
      qc.setQueriesData<AgendaBooking[]>({ queryKey: ["agenda"] }, (d) => d?.filter((b) => b.id !== id));
      return { snapshot };
    },
    onError: (e, _id, ctx) => {
      for (const [key, data] of ctx?.snapshot ?? []) qc.setQueryData(key, data);
      toast(e.message);
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ["agenda"] });
      qc.invalidateQueries({ queryKey: ["home"] });
    },
  });

  const confirmRemove = () =>
    booking &&
    Alert.alert("Remover do horário?", `${booking.name} sai deste horário.`, [
      { text: "Cancelar", style: "cancel" },
      { text: "Remover", style: "destructive", onPress: () => { remove.mutate(booking.id); onClose(); } },
    ]);

  return (
    <Sheet open={!!booking} onClose={onClose} title={booking?.name}>
      {booking && (
        <>
          <View style={{ flexDirection: "row", gap: 12, alignItems: "center" }}>
            <Avatar name={booking.name} size={44} />
            <View style={{ flex: 1, gap: 4 }}>
              <Text color="ink2">{formatWeekdayDate(booking.date)}, {booking.time}</Text>
              <ModalityTag modality={booking.modalityKey} label={booking.label} />
              {isAdmin && booking.modalityKey && <Text variant="small" color="ink2">{booking.instructorName ? `Instrutor: ${booking.instructorName}` : "Sem instrutor"}</Text>}
              {booking.replacesDate && <Text variant="small" color="accent" style={{ fontWeight: "700" }}>Reposição de {formatDayMonth(booking.replacesDate)}</Text>}
            </View>
          </View>

          <StatusPicker
            status={booking.status}
            missReason={booking.missReason}
            onSelect={(status, reason) => setStatus.mutate({ bookingId: booking.id, status, reason })}
            onDone={onClose}
          />

          {booking.modalityId && (
            <Card flat>
              <Text variant="tiny" color="ink3">{last.data ? `Última evolução · ${last.data.date}` : "Última evolução"}</Text>
              {last.isPending ? <Text variant="small" color="ink3">Carregando…</Text> : last.data ? <Text variant="small">{last.data.text || last.data.title}</Text> : <Text variant="small" color="ink2">Sem evolução ainda</Text>}
            </Card>
          )}

          <View style={{ flexDirection: "row", gap: 8 }}>
            <View style={{ flex: 1 }}>
              <Button kind="secondary" label="Ver detalhes" onPress={() => { onClose(); router.push(`/clientes/${booking.clientId}`); }} />
            </View>
            {isPresent(booking.status) && booking.modalityKey && (
              <View style={{ flex: 1.2 }}>
                <Button label="Escrever evolução" onPress={() => { onClose(); router.push({ pathname: "/clientes/[id]/evolucoes/nova", params: { id: booking.clientId, modalidade: booking.modalityKey!, sessao: booking.id } }); }} />
              </View>
            )}
          </View>
          <Button kind="quiet" label="Remover deste horário" onPress={confirmRemove} />
        </>
      )}
    </Sheet>
  );
}
