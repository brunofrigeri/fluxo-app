import { addRecurringSlot, removeRecurringSlot, type ClientDetail, type Modality } from "@fluxo/api";
import { WEEKDAY_ORDER } from "@fluxo/api";
import { weekdayName } from "@fluxo/domain";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Alert, Pressable, View } from "react-native";
import { supabase } from "@/lib/supabase";
import { useToast } from "@/lib/toast";
import { Banner } from "@/ui/Banner";
import { Button } from "@/ui/Button";
import { Card } from "@/ui/Card";
import { ChoiceRow } from "@/ui/ChoiceRow";
import { Icon } from "@/ui/Icon";
import { ModalityTag } from "@/ui/ModalityTag";
import { Text } from "@/ui/Text";
import { useTheme } from "@/ui/theme";

const HOURS = Array.from({ length: 15 }, (_, i) => 6 + i);

/** Horários semanais: add and remove recurring slots. Removal is optimistic; adding is a real submit. */
export function SlotsSection({ clientId, slots, enrolled, active }: { clientId: string; slots: ClientDetail["slots"]; enrolled: Modality[]; active: boolean }) {
  const theme = useTheme();
  const qc = useQueryClient();
  const toast = useToast();
  const [adding, setAdding] = useState(false);
  const [modalityId, setModalityId] = useState(enrolled[0]?.id ?? "");
  const [weekday, setWeekday] = useState("1");
  const [hour, setHour] = useState("7");
  const [error, setError] = useState<string | null>(null);
  const keys = ["client", clientId];
  const refresh = () => {
    for (const k of [keys, ["agenda"], ["home"], ["clients"]]) qc.invalidateQueries({ queryKey: k });
  };

  const add = useMutation({
    mutationFn: async () => {
      const r = await addRecurringSlot(supabase, clientId, { weekday: Number(weekday), hour: Number(hour), modalityId: modalityId || enrolled[0]?.id });
      if (r.error) throw new Error(r.error);
    },
    onSuccess: () => {
      setAdding(false);
      refresh();
    },
    onError: (e) => setError(e.message),
  });

  const remove = useMutation({
    mutationFn: async (slotId: string) => {
      const r = await removeRecurringSlot(supabase, slotId);
      if (r.error) throw new Error(r.error);
    },
    onMutate: async (slotId) => {
      await qc.cancelQueries({ queryKey: keys });
      const previous = qc.getQueryData<ClientDetail>(keys);
      qc.setQueryData<ClientDetail>(keys, (d) => d && { ...d, slots: d.slots.filter((s) => s.id !== slotId) });
      return { previous };
    },
    onError: (e, _id, ctx) => {
      qc.setQueryData(keys, ctx?.previous);
      toast(e.message);
    },
    onSettled: refresh,
  });

  const confirmRemove = (id: string) =>
    Alert.alert("Remover horário?", "As sessões futuras ainda sem status também serão removidas da agenda.", [
      { text: "Cancelar", style: "cancel" },
      { text: "Remover", style: "destructive", onPress: () => remove.mutate(id) },
    ]);

  const modalityOf = (id: string) => enrolled.find((m) => m.id === id);

  return (
    <Card>
      <Text variant="h3">Horários semanais</Text>
      {slots.length === 0 && <Text variant="small" color="ink2">Nenhum horário fixo. Os agendamentos podem ser feitos na Agenda.</Text>}
      {slots.map((s) => (
        <View key={s.id} style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
          <Icon name="repeat" size={16} color={theme.ink3} />
          <View style={{ flex: 1, gap: 2 }}>
            <Text variant="h3">{weekdayName(s.weekday)}</Text>
            <Text variant="small" color="ink2">{String(s.hour).padStart(2, "0")}:00 – {String(s.hour + 1).padStart(2, "0")}:00</Text>
          </View>
          {modalityOf(s.modalityId) && <ModalityTag modality={modalityOf(s.modalityId)!.key} />}
          <Pressable accessibilityRole="button" accessibilityLabel="Remover horário" onPress={() => confirmRemove(s.id)} hitSlop={10}>
            <Icon name="x" size={18} color={theme.ink2} />
          </Pressable>
        </View>
      ))}
      {active && enrolled.length > 0 && !adding && <Button kind="secondary" label="Adicionar horário" onPress={() => { setError(null); setAdding(true); }} />}
      {adding && (
        <View style={{ gap: 10 }}>
          {enrolled.length > 1 && <ChoiceRow value={modalityId || enrolled[0].id} onChange={setModalityId} items={enrolled.map((m) => ({ value: m.id, label: m.name }))} />}
          <ChoiceRow value={weekday} onChange={setWeekday} items={WEEKDAY_ORDER.map((d) => ({ value: String(d), label: weekdayName(d) }))} />
          <ChoiceRow value={hour} onChange={setHour} items={HOURS.map((h) => ({ value: String(h), label: `${String(h).padStart(2, "0")}:00` }))} />
          {error && <Banner>{error}</Banner>}
          <View style={{ flexDirection: "row", gap: 8, justifyContent: "flex-end" }}>
            <Button kind="secondary" label="Cancelar" onPress={() => setAdding(false)} />
            <Button label={add.isPending ? "Adicionando…" : "Adicionar"} disabled={add.isPending} onPress={() => { setError(null); add.mutate(); }} />
          </View>
        </View>
      )}
    </Card>
  );
}
