import { getClientHead, getEvolution, getSessionOptions } from "@fluxo/api";
import { formatBR } from "@fluxo/domain";
import { editableData, getForm } from "@fluxo/forms";
import { useQuery } from "@tanstack/react-query";
import { useLocalSearchParams } from "expo-router";
import { EvolutionEditor } from "@/features/clients/EvolutionEditor";
import { supabase } from "@/lib/supabase";
import { Banner } from "@/ui/Banner";
import { Empty } from "@/ui/Empty";
import { ModalityTag } from "@/ui/ModalityTag";
import { Screen } from "@/ui/Screen";
import { Text } from "@/ui/Text";

export default function EditEvolution() {
  const { id, evoId } = useLocalSearchParams<{ id: string; evoId: string }>();
  const q = useQuery({
    queryKey: ["evolution-edit", id, evoId],
    gcTime: 0,
    queryFn: async () => {
      const [head, evo] = await Promise.all([getClientHead(supabase, id), getEvolution(supabase, id, evoId)]);
      const sessions = evo ? await getSessionOptions(supabase, id, evo.modalityId, evo.bookingId) : [];
      return { head, evo, sessions };
    },
  });

  if (q.isPending) return <Screen back title="Editar evolução"><Text color="ink2">Carregando…</Text></Screen>;
  if (q.isError) return <Screen back title="Editar evolução"><Banner>{(q.error as Error).message}</Banner></Screen>;
  const { head, evo, sessions } = q.data;
  if (!head || !evo) return <Screen back title="Editar evolução"><Empty title="Evolução não encontrada" /></Screen>;

  return (
    <Screen back title="Editar evolução" subtitle={`${head.name} · ${formatBR(evo.date)}`} right={<ModalityTag modality={evo.modality} />}>
      <EvolutionEditor
        clientId={id}
        modality={evo.modality}
        evolutionId={evo.id}
        initialDate={evo.date}
        initialBookingId={evo.bookingId}
        initialSessionNumber={evo.sessionNumber}
        initialData={editableData(getForm(evo.modality, "evolution"), evo.data)}
        sessions={sessions}
      />
    </Screen>
  );
}
