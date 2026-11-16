import { deleteEvolution, getClientHead, getEvolution } from "@fluxo/api";
import { formatBR } from "@fluxo/domain";
import { getForm } from "@fluxo/forms";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Alert, View } from "react-native";
import { FormReadView } from "@/forms/FormReadView";
import { supabase } from "@/lib/supabase";
import { useToast } from "@/lib/toast";
import { Banner } from "@/ui/Banner";
import { Button } from "@/ui/Button";
import { Empty } from "@/ui/Empty";
import { ModalityTag } from "@/ui/ModalityTag";
import { Screen } from "@/ui/Screen";
import { Text } from "@/ui/Text";

export default function EvolutionPage() {
  const { id, evoId } = useLocalSearchParams<{ id: string; evoId: string }>();
  const router = useRouter();
  const qc = useQueryClient();
  const toast = useToast();

  const q = useQuery({
    queryKey: ["evolution", id, evoId],
    queryFn: async () => {
      const [head, evo] = await Promise.all([getClientHead(supabase, id), getEvolution(supabase, id, evoId)]);
      return { head, evo };
    },
  });

  const remove = useMutation({
    mutationFn: async () => {
      const r = await deleteEvolution(supabase, id, evoId);
      if (r.error) throw new Error(r.error);
    },
    onSuccess: () => {
      for (const k of ["evolutions", "home", "last-evolution"]) qc.invalidateQueries({ queryKey: [k] });
      router.replace({ pathname: "/clientes/[id]", params: { id, aba: "evolucoes" } });
    },
    onError: (e) => toast(e.message),
  });

  if (q.isPending) return <Screen back title="Evolução"><Text color="ink2">Carregando…</Text></Screen>;
  if (q.isError) return <Screen back title="Evolução"><Banner>{(q.error as Error).message}</Banner></Screen>;
  const { head, evo } = q.data;
  if (!head || !evo) return <Screen back title="Evolução"><Empty title="Evolução não encontrada">Ela pode ter sido removida ou você não tem acesso.</Empty></Screen>;

  const confirmDelete = () =>
    Alert.alert("Excluir esta evolução?", "Isso não pode ser desfeito.", [
      { text: "Cancelar", style: "cancel" },
      { text: "Excluir", style: "destructive", onPress: () => remove.mutate() },
    ]);

  return (
    <Screen back title={`Evolução nº ${evo.sessionNumber}`} subtitle={`${head.name} · ${formatBR(evo.date)}`} right={<ModalityTag modality={evo.modality} />}>
      <FormReadView def={getForm(evo.modality, "evolution")} data={evo.data} />
      <View style={{ flexDirection: "row", gap: 8 }}>
        <View style={{ flex: 1 }}><Button kind="secondary" label="Editar" onPress={() => router.push({ pathname: "/clientes/[id]/evolucoes/[evoId]/editar", params: { id, evoId } })} /></View>
        <View style={{ flex: 1 }}><Button kind="quiet" label="Excluir" disabled={remove.isPending} onPress={confirmDelete} /></View>
      </View>
    </Screen>
  );
}
