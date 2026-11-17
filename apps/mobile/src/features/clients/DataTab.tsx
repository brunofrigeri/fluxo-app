import { setArchived, updateClient, type ClientDetail, type Modality } from "@fluxo/api";
import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Alert, View } from "react-native";
import { useMe } from "@/lib/me";
import { useModalityChoices } from "@/lib/hooks/useInstructors";
import { supabase } from "@/lib/supabase";
import { useToast } from "@/lib/toast";
import { Button } from "@/ui/Button";
import { Card } from "@/ui/Card";
import { TagList } from "@/ui/TagList";
import { Text } from "@/ui/Text";
import { ClientForm, toEnrollments, toInput, type ClientValues, type Picked } from "./ClientForm";
import { DocumentsSection } from "./DocumentsSection";
import { SlotsSection } from "./SlotsSection";

export function DataTab({ detail, enrolled }: { detail: ClientDetail; enrolled: Modality[] }) {
  const { me, isAdmin, studioModalities } = useMe();
  const qc = useQueryClient();
  const toast = useToast();
  const choices = useModalityChoices(studioModalities);
  const c = detail.client;
  const [lists, setLists] = useState({ diseases: c.diseases, surgeries: c.surgeries, current_treatments: c.current_treatments, previous_treatments: c.previous_treatments, medications: c.medications });
  const setList = (k: keyof typeof lists) => (v: string[]) => setLists((l) => ({ ...l, [k]: v }));

  const initial: ClientValues = {
    document: c.document, name: c.name, email: c.email ?? "", phone: c.phone ?? "", emergency_contact_name: c.emergency_contact_name ?? "", emergency_contact_phone: c.emergency_contact_phone ?? "",
    date_of_birth: c.date_of_birth ?? "", sex: c.sex ?? "", marital_status: c.marital_status ?? "", city: c.city ?? "", profession: c.profession ?? "", workplace: c.workplace ?? "",
    children: c.children ?? "", parents: c.parents ?? "", billing_day: c.billing_day === null ? "" : String(c.billing_day),
  };
  const picked: Picked = Object.fromEntries(detail.enrollment.map((e) => [e.modalityId, e.instructorId ?? ""]));

  const refresh = () => {
    for (const k of ["client", "clients", "home", "agenda", "dialog-clients"]) qc.invalidateQueries({ queryKey: [k] });
  };

  async function save(values: ClientValues, nextPicked: Picked): Promise<string | void> {
    const r = await updateClient(supabase, me, c.id, toInput(values), lists, isAdmin ? toEnrollments(nextPicked) : undefined);
    if (r.error) return r.error;
    refresh();
    toast("Dados salvos.", "info");
  }

  function archive() {
    const archiving = c.active;
    Alert.alert(archiving ? "Arquivar cliente?" : "Reativar cliente?", archiving ? `${c.name} sai das listas e das sessões futuras, e o histórico é mantido.` : `Reativar ${c.name}?`, [
      { text: "Cancelar", style: "cancel" },
      {
        text: archiving ? "Arquivar" : "Reativar",
        style: archiving ? "destructive" : "default",
        onPress: async () => {
          const r = await setArchived(supabase, c.id, archiving);
          if (r.error) toast(r.error);
          else refresh();
        },
      },
    ]);
  }

  return (
    <View style={{ gap: 16 }}>
      <ClientForm key={c.id} initial={initial} picked={picked} modalities={choices} canEditModalities={isAdmin} canReassign={isAdmin} canEditBilling={isAdmin} submitLabel="Salvar" onSubmit={save}>
        <Card style={{ gap: 18 }}>
          <TagList title="Doenças" items={lists.diseases} onChange={setList("diseases")} placeholder="Adicionar doença" />
          <TagList title="Cirurgias" items={lists.surgeries} onChange={setList("surgeries")} placeholder="Adicionar cirurgia" />
          <TagList title="Tratamentos atuais" items={lists.current_treatments} onChange={setList("current_treatments")} placeholder="Adicionar tratamento atual" />
          <TagList title="Tratamentos anteriores" items={lists.previous_treatments} onChange={setList("previous_treatments")} placeholder="Adicionar tratamento anterior" />
          <TagList title="Medicação" items={lists.medications} onChange={setList("medications")} placeholder="Adicionar medicação" />
          <Text variant="small" color="ink3">O histórico de saúde é gravado com o botão Salvar dos dados pessoais.</Text>
        </Card>
      </ClientForm>
      <DocumentsSection clientId={c.id} />
      <SlotsSection clientId={c.id} slots={detail.slots} enrolled={enrolled} active={c.active} />
      <Button kind="quiet" label={c.active ? "Arquivar cliente" : "Reativar cliente"} onPress={archive} />
    </View>
  );
}
