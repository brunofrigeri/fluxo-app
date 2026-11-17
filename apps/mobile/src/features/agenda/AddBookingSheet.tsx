import { createBooking, getDialogClients, type DialogClient } from "@fluxo/api";
import { FIRST_HOUR, LAST_HOUR } from "@fluxo/domain";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { Pressable, Switch, TextInput, View } from "react-native";
import { useMe } from "@/lib/me";
import { supabase } from "@/lib/supabase";
import { Avatar } from "@/ui/Avatar";
import { Banner } from "@/ui/Banner";
import { Button } from "@/ui/Button";
import { Card } from "@/ui/Card";
import { ChoiceRow } from "@/ui/ChoiceRow";
import { DateField } from "@/ui/DateField";
import { figtreeFamily } from "@/ui/fonts";
import { Sheet } from "@/ui/Sheet";
import { Text } from "@/ui/Text";
import { TextField } from "@/ui/TextField";
import { useTheme } from "@/ui/theme";

export type AddInitial = { date: string; hour: number; clientId?: string; missId?: string; modalityId?: string };

/** The "Outra atividade" choice: a one-off entry with a free-text label, no modality and no evolution form. */
const OTHER = "other";
const HOURS = Array.from({ length: LAST_HOUR - FIRST_HOUR + 1 }, (_, i) => FIRST_HOUR + i);
const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

/**
 * Adds a client to a slot (or schedules a replacement for a justified miss). The list of clients is fetched ahead of
 * time by the agenda, so the sheet opens at once and the search is local.
 */
export function AddBookingSheet({ initial, onClose }: { initial: AddInitial | null; onClose: () => void }) {
  const { teachable } = useMe();
  const theme = useTheme();
  const qc = useQueryClient();
  const open = !!initial;

  const clientsQ = useQuery({ queryKey: ["dialog-clients"], queryFn: () => getDialogClients(supabase), staleTime: 60_000 });
  const clients: DialogClient[] | null = clientsQ.data ?? null;

  const [query, setQuery] = useState("");
  const [clientId, setClientId] = useState<string | null>(null);
  const [replacement, setReplacement] = useState(false);
  const [missId, setMissId] = useState<string | null>(null);
  const [date, setDate] = useState("");
  const [hour, setHour] = useState(7);
  const [mode, setMode] = useState<string>(teachable[0]?.id ?? OTHER);
  const [label, setLabel] = useState("");
  const [error, setError] = useState<string | null>(null);
  const isOther = mode === OTHER;

  useEffect(() => {
    if (!initial) return;
    setQuery("");
    setError(null);
    setLabel("");
    setDate(initial.date);
    setHour(initial.hour);
    setClientId(initial.clientId ?? null);
    setMissId(initial.missId ?? null);
    setReplacement(Boolean(initial.missId));
    setMode(initial.modalityId && teachable.some((m) => m.id === initial.modalityId) ? initial.modalityId : (teachable[0]?.id ?? OTHER));
  }, [initial, teachable]);

  // Only clients enrolled in the chosen modality can be booked in it.
  const enrolled = useMemo(() => (clients ?? []).filter((c) => isOther || c.modalityIds.includes(mode)), [clients, isOther, mode]);
  const selected = enrolled.find((c) => c.id === clientId) ?? null;
  const misses = selected && !isOther ? selected.misses.filter((m) => m.modalityId === mode) : [];
  const results = useMemo(() => {
    const q = norm(query.trim());
    return q ? enrolled.filter((c) => norm(c.name).includes(q)).slice(0, 6) : [];
  }, [enrolled, query]);
  const needsMiss = replacement && selected && misses.length > 0;
  const canSubmit = Boolean(selected) && (isOther ? label.trim() !== "" : !replacement || Boolean(missId));

  function chooseMode(next: string) {
    if (next === mode) return;
    setMode(next);
    setMissId(null);
    if (next === OTHER) setReplacement(false);
    if (clientId && next !== OTHER && !(clients ?? []).find((c) => c.id === clientId)?.modalityIds.includes(next)) setClientId(null);
  }

  const save = useMutation({
    mutationFn: async () => {
      if (!selected) return;
      const r = await createBooking(
        supabase,
        isOther
          ? { clientId: selected.id, date, hour, label: label.trim() }
          : { clientId: selected.id, date, hour, modalityId: mode, replacesId: replacement ? (missId ?? undefined) : undefined },
      );
      if (r.error) throw new Error(r.error);
    },
    onSuccess: () => {
      for (const key of ["agenda", "home", "dialog-clients"]) qc.invalidateQueries({ queryKey: [key] });
      onClose();
    },
    onError: (e) => setError(e.message),
  });

  const first = (name: string) => name.split(" ")[0];

  return (
    <Sheet open={open} onClose={onClose} title={replacement && !isOther ? "Agendar reposição" : "Adicionar cliente"}>
      <View style={{ gap: 6 }}>
        <Text variant="small" color="ink2" style={{ fontWeight: "600" }}>Modalidade</Text>
        <ChoiceRow value={mode} onChange={chooseMode} items={[...teachable.map((m) => ({ value: m.id, label: m.name })), { value: OTHER, label: "Outra atividade" }]} />
        {isOther && (
          <>
            <TextField label="Nome da atividade" value={label} onChangeText={setLabel} maxLength={80} placeholder="Ex.: Aula experimental" help="Fica na agenda sem formulário de evolução." />
          </>
        )}
      </View>

      <DateField label="Data" value={date} onChange={setDate} />
      <View style={{ gap: 6 }}>
        <Text variant="small" color="ink2" style={{ fontWeight: "600" }}>Horário</Text>
        <ChoiceRow value={String(hour)} onChange={(v) => setHour(Number(v))} items={HOURS.map((h) => ({ value: String(h), label: `${String(h).padStart(2, "0")}:00` }))} />
      </View>

      <View style={{ gap: 6 }}>
        <Text variant="small" color="ink2" style={{ fontWeight: "600" }}>Cliente</Text>
        {selected ? (
          <Card flat style={{ flexDirection: "row", alignItems: "center", gap: 10, padding: 10 }}>
            <Avatar name={selected.name} size={32} />
            <Text variant="h3" style={{ flex: 1 }}>{selected.name}</Text>
            <Button kind="quiet" label="Trocar" onPress={() => { setClientId(null); setMissId(null); }} />
          </Card>
        ) : (
          <>
            <TextInput
              accessibilityLabel="Buscar cliente"
              placeholder="Buscar cliente"
              placeholderTextColor={theme.ink3}
              value={query}
              onChangeText={setQuery}
              autoCorrect={false}
              editable={!!clients}
              style={{ height: 46, paddingHorizontal: 14, borderRadius: 12, borderWidth: 1, borderColor: theme.line, backgroundColor: theme.surface, color: theme.ink, fontSize: 15, fontFamily: figtreeFamily(400) }}
            />
            {!clients ? (
              <Text variant="small" color="ink3">Carregando clientes…</Text>
            ) : query.trim() === "" ? (
              <Text variant="small" color="ink3">Digite para buscar. Aparecem só clientes desta modalidade; arquivados ficam de fora.</Text>
            ) : results.length === 0 ? (
              <Text variant="small" color="ink3">Nenhum cliente encontrado.</Text>
            ) : (
              <Card flat style={{ padding: 6, gap: 0 }}>
                {results.map((c) => (
                  <Pressable key={c.id} accessibilityRole="button" onPress={() => { setClientId(c.id); setMissId(c.misses.find((m) => m.modalityId === mode)?.id ?? null); }} style={{ flexDirection: "row", alignItems: "center", gap: 10, minHeight: 48, paddingHorizontal: 8 }}>
                    <Avatar name={c.name} size={32} />
                    <Text variant="h3">{c.name}</Text>
                  </Pressable>
                ))}
              </Card>
            )}
          </>
        )}
      </View>

      {!isOther && (
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
          <Text variant="small" color="ink2" style={{ fontWeight: "600" }}>É reposição?</Text>
          <Switch value={replacement} onValueChange={setReplacement} trackColor={{ true: theme.accent }} accessibilityLabel="É reposição?" />
        </View>
      )}

      {replacement && !isOther && selected && (
        needsMiss ? (
          <View style={{ gap: 8 }}>
            <Text variant="small" color="ink2" style={{ fontWeight: "600" }}>Qual falta justificada {first(selected.name)} repõe?</Text>
            {misses.map((m) => (
              <Pressable key={m.id} accessibilityRole="radio" accessibilityState={{ selected: missId === m.id }} onPress={() => setMissId(m.id)}>
                <Card flat style={{ borderWidth: 2, borderColor: missId === m.id ? theme.accent : "transparent", padding: 12, gap: 2 }}>
                  <Text variant="h3">{m.label}</Text>
                  {m.reason && <Text variant="small" color="ink2">Motivo: {m.reason}</Text>}
                </Card>
              </Pressable>
            ))}
          </View>
        ) : (
          <Banner tone="info">{`${first(selected.name)} não tem falta justificada pendente de reposição.`}</Banner>
        )
      )}

      {error && <Banner>{error}</Banner>}

      <Button label={save.isPending ? "Salvando…" : replacement && !isOther ? "Agendar reposição" : "Adicionar"} disabled={!canSubmit || save.isPending} onPress={() => { setError(null); save.mutate(); }} />
    </Sheet>
  );
}
