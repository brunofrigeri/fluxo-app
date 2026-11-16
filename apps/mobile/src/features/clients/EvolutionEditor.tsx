import { saveEvolution, type SessionOption } from "@fluxo/api";
import { todayISO } from "@fluxo/domain";
import { filledCount, getForm, type ModalityKey, type RecordData } from "@fluxo/forms";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { useState } from "react";
import { View } from "react-native";
import { FormFields } from "@/forms/FormFields";
import { supabase } from "@/lib/supabase";
import { Banner } from "@/ui/Banner";
import { Button } from "@/ui/Button";
import { Card } from "@/ui/Card";
import { ChoiceRow } from "@/ui/ChoiceRow";
import { DateField } from "@/ui/DateField";
import { Pill } from "@/ui/Pill";
import { Text } from "@/ui/Text";
import { TextField } from "@/ui/TextField";

/** The evolution of any modality: shared fields (date, session, number) plus the modality's own form. */
export function EvolutionEditor({ clientId, modality, evolutionId, initialDate, initialBookingId, initialSessionNumber, initialData, sessions }: {
  clientId: string;
  modality: ModalityKey;
  evolutionId: string | null;
  initialDate?: string;
  initialBookingId: string | null;
  initialSessionNumber: number;
  initialData: RecordData;
  sessions: SessionOption[];
}) {
  const def = getForm(modality, "evolution");
  const router = useRouter();
  const qc = useQueryClient();
  const startDate = initialDate ?? todayISO();
  const [data, setData] = useState<RecordData>(initialData);
  const [date, setDate] = useState(startDate);
  const [bookingId, setBookingId] = useState(initialBookingId ?? "");
  const [sessionNumber, setSessionNumber] = useState(String(initialSessionNumber));
  const [error, setError] = useState<string | null>(null);

  const dirty = JSON.stringify(data) !== JSON.stringify(initialData) || date !== startDate || bookingId !== (initialBookingId ?? "") || sessionNumber !== String(initialSessionNumber);

  function chooseSession(id: string) {
    setBookingId(id);
    const s = sessions.find((x) => x.id === id);
    if (s) setDate(s.date);
  }

  const save = useMutation({
    mutationFn: async () => {
      const r = await saveEvolution(supabase, { clientId, modality, evolutionId, date, bookingId: bookingId || null, sessionNumber: Number.parseInt(sessionNumber, 10), data });
      if (r.error || !r.id) throw new Error(r.error);
      return r.id;
    },
    onSuccess: (id) => {
      for (const k of ["evolutions", "home", "last-evolution", "client"]) qc.invalidateQueries({ queryKey: [k] });
      router.replace({ pathname: "/clientes/[id]/evolucoes/[evoId]", params: { id: clientId, evoId: id } });
    },
    onError: (e) => setError(e.message),
  });

  return (
    <View style={{ gap: 16 }}>
      <Card style={{ gap: 14 }}>
        <DateField label="Data" value={date} onChange={(d) => setDate(d || todayISO())} />
        <TextField label="Nº da sessão" value={sessionNumber} onChangeText={setSessionNumber} keyboardType="number-pad" />
        <View style={{ gap: 6 }}>
          <Text variant="small" color="ink2" style={{ fontWeight: "600" }}>Sessão vinculada (opcional)</Text>
          <ChoiceRow value={bookingId} onChange={chooseSession} items={[{ value: "", label: "Sem sessão vinculada" }, ...sessions.map((s) => ({ value: s.id, label: s.label }))]} />
        </View>
        <Text variant="small" color="ink3">Só é possível registrar evolução para quem esteve presente ou fez reposição.</Text>
      </Card>

      <FormFields def={def} value={data} onChange={setData} />

      {filledCount(def, data) === 0 && <Text variant="small" color="ink2">Preencha ao menos um campo da evolução.</Text>}
      {error && <Banner>{error}</Banner>}
      {dirty && <Pill label="Alterações não salvas" />}
      <View style={{ flexDirection: "row", gap: 8 }}>
        <View style={{ flex: 1 }}><Button kind="secondary" label="Cancelar" onPress={() => router.back()} /></View>
        <View style={{ flex: 1.4 }}><Button label={save.isPending ? "Salvando…" : "Salvar evolução"} disabled={save.isPending} onPress={() => { setError(null); save.mutate(); }} /></View>
      </View>
    </View>
  );
}
