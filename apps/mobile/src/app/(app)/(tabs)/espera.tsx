import { addToWaitList, getWaitList, removeFromWaitList, updateWaitEntry, type WaitEntry } from "@fluxo/api";
import { formatBR, PERIODS, PERIOD_LABELS, maskPhone, type Period } from "@fluxo/domain";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Alert, Pressable, View } from "react-native";
import { useMe } from "@/lib/me";
import { supabase } from "@/lib/supabase";
import { useToast } from "@/lib/toast";
import { Banner } from "@/ui/Banner";
import { Button } from "@/ui/Button";
import { Card } from "@/ui/Card";
import { ChoiceRow } from "@/ui/ChoiceRow";
import { Empty } from "@/ui/Empty";
import { Icon } from "@/ui/Icon";
import { ModalityTag } from "@/ui/ModalityTag";
import { Screen } from "@/ui/Screen";
import { Seg } from "@/ui/Seg";
import { Sheet } from "@/ui/Sheet";
import { Text } from "@/ui/Text";
import { TextField } from "@/ui/TextField";
import { useTheme } from "@/ui/theme";

type Filter = "all" | Period;

export default function Espera() {
  const { studioModalities } = useMe();
  const theme = useTheme();
  const qc = useQueryClient();
  const toast = useToast();
  const [filter, setFilter] = useState<Filter>("all");
  const [sheet, setSheet] = useState<{ entry: WaitEntry | null } | null>(null);

  const q = useQuery({ queryKey: ["waitlist"], queryFn: () => getWaitList(supabase) });
  const all = q.data ?? [];
  const counts: Record<Period, number> = { MORNING: 0, AFTERNOON: 0, NIGHT: 0 };
  for (const e of all) counts[e.period] += 1;
  const rows = filter === "all" ? all : all.filter((e) => e.period === filter);
  const modalityKey = (id: string) => studioModalities.find((m) => m.id === id)?.key ?? null;

  // Removal is optimistic: the row leaves at once and comes back with a message if the server says no.
  const remove = useMutation({
    mutationFn: async (id: string) => {
      const r = await removeFromWaitList(supabase, id);
      if (r.error) throw new Error(r.error);
    },
    onMutate: async (id) => {
      await qc.cancelQueries({ queryKey: ["waitlist"] });
      const previous = qc.getQueryData<WaitEntry[]>(["waitlist"]);
      qc.setQueryData<WaitEntry[]>(["waitlist"], (d) => d?.filter((e) => e.id !== id));
      return { previous };
    },
    onError: (e, _id, ctx) => {
      qc.setQueryData(["waitlist"], ctx?.previous);
      toast(e.message);
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ["waitlist"] }),
  });

  const confirmRemove = (e: WaitEntry) =>
    Alert.alert("Remover da lista?", `${e.name} sai da lista de espera.`, [
      { text: "Cancelar", style: "cancel" },
      { text: "Remover", style: "destructive", onPress: () => remove.mutate(e.id) },
    ]);

  return (
    <Screen
      title="Lista de espera"
      subtitle={all.length === 0 ? "Ninguém na lista" : `${all.length} ${all.length === 1 ? "pessoa" : "pessoas"} esperando uma vaga`}
      right={<Button label="Adicionar" onPress={() => setSheet({ entry: null })} />}
      refreshing={q.isRefetching}
      onRefresh={() => q.refetch()}
      header={
        <View style={{ paddingBottom: 4 }}>
          <Seg
            label="Período"
            value={filter}
            onChange={setFilter}
            items={[{ value: "all", label: `Todos (${all.length})` }, ...PERIODS.map((p) => ({ value: p, label: `${PERIOD_LABELS[p]} (${counts[p]})` }))]}
          />
        </View>
      }
    >
      {q.isError && <Banner>{(q.error as Error).message}</Banner>}
      {q.isPending && <Text color="ink2">Carregando…</Text>}
      {q.data && rows.length === 0 && <Empty title="Ninguém por aqui">Quem entra primeiro aparece primeiro.</Empty>}

      {rows.map((e) => (
        <Card key={e.id} style={{ gap: 8 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <Text variant="h3" style={{ flex: 1 }}>{e.name}</Text>
            <Pressable accessibilityRole="button" accessibilityLabel={`Editar ${e.name}`} onPress={() => setSheet({ entry: e })} hitSlop={10}>
              <Icon name="edit" size={20} color={theme.ink2} />
            </Pressable>
            <Pressable accessibilityRole="button" accessibilityLabel={`Remover ${e.name}`} onPress={() => confirmRemove(e)} hitSlop={10}>
              <Icon name="x" size={20} color={theme.ink2} />
            </Pressable>
          </View>
          <Text color="ink2">{e.phone}</Text>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            <Text variant="small" color="ink2">{PERIOD_LABELS[e.period]}</Text>
            {studioModalities.length > 1 && <ModalityTag modality={modalityKey(e.modalityId)} />}
            <Text variant="small" color="ink3">Desde {formatBR(e.createdAt)}</Text>
          </View>
        </Card>
      ))}

      <WaitSheet entry={sheet?.entry ?? null} open={!!sheet} onClose={() => setSheet(null)} />
    </Screen>
  );
}

function WaitSheet({ open, onClose, entry }: { open: boolean; onClose: () => void; entry: WaitEntry | null }) {
  const { me, studioModalities } = useMe();
  const qc = useQueryClient();
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [period, setPeriod] = useState<Period>("MORNING");
  const [modalityId, setModalityId] = useState(studioModalities[0]?.id ?? "");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setError(null);
    setName(entry?.name ?? "");
    setPhone(entry?.phone ?? "");
    setPeriod(entry?.period ?? "MORNING");
    setModalityId(entry?.modalityId ?? studioModalities[0]?.id ?? "");
  }, [open, entry, studioModalities]);

  // A real submit: it may show a pending state, but the sheet itself opened and closes at once.
  const save = useMutation({
    mutationFn: async () => {
      const input = { name, phone, period, modalityId };
      const r = entry ? await updateWaitEntry(supabase, entry.id, input) : await addToWaitList(supabase, me.studioId, input);
      if (r.error) throw new Error(r.error);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["waitlist"] });
      onClose();
    },
    onError: (e) => setError(e.message),
  });

  return (
    <Sheet open={open} onClose={onClose} title={entry ? "Editar" : "Adicionar à lista"}>
      <TextField label="Nome" value={name} onChangeText={setName} maxLength={120} autoCapitalize="words" />
      <TextField label="Telefone" value={phone} onChangeText={(v) => setPhone(maskPhone(v))} keyboardType="phone-pad" maxLength={40} />
      <View style={{ gap: 6 }}>
        <Text variant="small" color="ink2" style={{ fontWeight: "600" }}>Período</Text>
        <ChoiceRow value={period} onChange={setPeriod} items={PERIODS.map((p) => ({ value: p, label: PERIOD_LABELS[p] }))} />
      </View>
      {studioModalities.length > 1 && (
        <View style={{ gap: 6 }}>
          <Text variant="small" color="ink2" style={{ fontWeight: "600" }}>Modalidade</Text>
          <ChoiceRow value={modalityId} onChange={setModalityId} items={studioModalities.map((m) => ({ value: m.id, label: m.name }))} />
        </View>
      )}
      {error && <Banner>{error}</Banner>}
      <Button label={save.isPending ? "Salvando…" : "Salvar"} disabled={save.isPending} onPress={() => save.mutate()} />
    </Sheet>
  );
}
