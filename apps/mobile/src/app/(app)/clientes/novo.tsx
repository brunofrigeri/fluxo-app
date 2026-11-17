import { registerClient } from "@fluxo/api";
import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { ClientForm, EMPTY_CLIENT, toEnrollments, toInput, type ClientValues, type Picked } from "@/features/clients/ClientForm";
import { useMe } from "@/lib/me";
import { useModalityChoices } from "@/lib/hooks/useInstructors";
import { supabase } from "@/lib/supabase";
import { Screen } from "@/ui/Screen";

export default function NewClient() {
  const { me, isAdmin, teachable } = useMe();
  const router = useRouter();
  const qc = useQueryClient();
  const choices = useModalityChoices(teachable);

  async function create(values: ClientValues, picked: Picked): Promise<string | void> {
    const r = await registerClient(supabase, me, toInput(values), toEnrollments(picked));
    if (r.error || !r.id) return r.error;
    for (const k of ["clients", "home", "dialog-clients"]) qc.invalidateQueries({ queryKey: [k] });
    // A client that starts in Acupuncture gets the evaluation right away (it can be skipped and done later).
    const acupuncture = r.modalityKeys?.includes("acupuncture");
    router.replace({ pathname: "/clientes/[id]", params: acupuncture ? { id: r.id, aba: "avaliacoes", nova: "acupuncture" } : { id: r.id, aba: "dados" } });
  }

  return (
    <Screen back title="Novo cliente">
      <ClientForm initial={EMPTY_CLIENT} picked={{}} modalities={choices} canEditModalities canReassign={isAdmin} canEditBilling submitLabel="Criar cliente" onSubmit={create} />
    </Screen>
  );
}
