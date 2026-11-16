import { countEvolutions, getBookingModality, getClientHead, getClientModalities, getSessionOptions, pickModality } from "@fluxo/api";
import { useQuery } from "@tanstack/react-query";
import { useLocalSearchParams, useRouter } from "expo-router";
import { EvolutionEditor } from "@/features/clients/EvolutionEditor";
import { supabase } from "@/lib/supabase";
import { Banner } from "@/ui/Banner";
import { Button } from "@/ui/Button";
import { Empty } from "@/ui/Empty";
import { ModalityTag } from "@/ui/ModalityTag";
import { Screen } from "@/ui/Screen";
import { Text } from "@/ui/Text";
import { View } from "react-native";

export default function NewEvolution() {
  const { id, sessao, modalidade } = useLocalSearchParams<{ id: string; sessao?: string; modalidade?: string }>();
  const router = useRouter();

  const q = useQuery({
    queryKey: ["new-evolution", id, sessao ?? null, modalidade ?? null],
    gcTime: 0, // always start from fresh sessions and counts
    queryFn: async () => {
      const [head, modalities] = await Promise.all([getClientHead(supabase, id), getClientModalities(supabase, id)]);
      if (!head) return { head: null, modalities, modality: null, sessions: [], existing: 0 };
      // Which modality: the one of the linked session, else the one asked for, else the only one.
      let modality = pickModality(modalidade, modalities);
      if (sessao) {
        const mid = await getBookingModality(supabase, sessao, id);
        modality = modalities.find((m) => m.id === mid) ?? modality;
      }
      if (!modality && modalities.length === 1) modality = modalities[0];
      if (!modality) return { head, modalities, modality: null, sessions: [], existing: 0 };
      const [sessions, existing] = await Promise.all([getSessionOptions(supabase, id, modality.id, sessao), countEvolutions(supabase, id, modality.id)]);
      return { head, modalities, modality, sessions, existing };
    },
  });

  if (q.isPending) return <Screen back title="Nova evolução"><Text color="ink2">Carregando…</Text></Screen>;
  if (q.isError) return <Screen back title="Nova evolução"><Banner>{(q.error as Error).message}</Banner></Screen>;
  const { head, modalities, modality, sessions, existing } = q.data;
  if (!head) return <Screen back title="Nova evolução"><Empty title="Cliente não encontrado" /></Screen>;

  if (!modality) {
    return (
      <Screen back title="Nova evolução" subtitle={head.name}>
        <Text variant="h3">{modalities.length === 0 ? "Você não tem acesso a nenhuma modalidade deste cliente." : "De qual modalidade é a evolução?"}</Text>
        <View style={{ gap: 8 }}>
          {modalities.map((m) => <Button key={m.id} label={m.name} onPress={() => router.setParams({ modalidade: m.key })} />)}
        </View>
      </Screen>
    );
  }

  const chosen = sessions.find((s) => s.id === sessao);
  return (
    <Screen back title="Nova evolução" subtitle={`${head.name}${head.routine ? ` · ${head.routine}` : ""}`} right={<ModalityTag modality={modality.key} />}>
      <EvolutionEditor
        key={`${modality.id}-${sessao ?? ""}`}
        clientId={id}
        modality={modality.key}
        evolutionId={null}
        initialDate={chosen?.date}
        initialBookingId={chosen?.id ?? null}
        initialSessionNumber={existing + 1}
        initialData={{}}
        sessions={sessions}
      />
    </Screen>
  );
}
