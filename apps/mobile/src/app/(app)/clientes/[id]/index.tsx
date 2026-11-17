import { getClientDetail } from "@fluxo/api";
import { ageFrom, todayISO, weekdayName } from "@fluxo/domain";
import { useQuery } from "@tanstack/react-query";
import { useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { View } from "react-native";
import { DataTab } from "@/features/clients/DataTab";
import { EvaluationsTab } from "@/features/clients/EvaluationsTab";
import { EvolutionsTab } from "@/features/clients/EvolutionsTab";
import { ClientPaymentsTab } from "@/features/payments/ClientPaymentsTab";
import { useMe } from "@/lib/me";
import { supabase } from "@/lib/supabase";
import { Avatar } from "@/ui/Avatar";
import { Banner } from "@/ui/Banner";
import { Card } from "@/ui/Card";
import { Empty } from "@/ui/Empty";
import { ModalityTag } from "@/ui/ModalityTag";
import { Pill } from "@/ui/Pill";
import { Screen } from "@/ui/Screen";
import { Seg } from "@/ui/Seg";
import { Text } from "@/ui/Text";
import type { ModalityKey } from "@fluxo/forms";

type Tab = "dados" | "evolucoes" | "avaliacoes" | "pagamentos";

export default function ClientPage() {
  const { id, aba, nova } = useLocalSearchParams<{ id: string; aba?: string; nova?: string }>();
  const { studioModalities, isAdmin } = useMe();
  const [tab, setTab] = useState<Tab>(aba === "evolucoes" || aba === "avaliacoes" || (aba === "pagamentos" && isAdmin) ? aba : "dados");
  const q = useQuery({ queryKey: ["client", id], queryFn: () => getClientDetail(supabase, id) });

  if (q.isPending) return <Screen back title="Cliente"><Text color="ink2">Carregando…</Text></Screen>;
  if (q.isError) return <Screen back title="Cliente"><Banner>{(q.error as Error).message}</Banner></Screen>;
  if (!q.data) return <Screen back title="Cliente"><Empty title="Cliente não encontrado">Ele pode ter sido removido ou você não tem acesso.</Empty></Screen>;

  const { client, slots, enrollment } = q.data;
  // The modalities this person sees the client in (an instructor: only the ones they are responsible for).
  const enrolled = studioModalities.filter((m) => enrollment.some((e) => e.modalityId === m.id));
  const age = ageFrom(client.date_of_birth, todayISO());
  const modalityOf = (mid: string) => enrolled.find((m) => m.id === mid);

  return (
    <Screen
      back
      title={client.name}
      refreshing={q.isRefetching}
      onRefresh={() => q.refetch()}
      header={<View style={{ paddingBottom: 4 }}><Seg label="Seção" value={tab} onChange={setTab} items={[{ value: "dados", label: "Dados" }, { value: "evolucoes", label: "Evoluções" }, { value: "avaliacoes", label: "Avaliações" }, ...(isAdmin ? [{ value: "pagamentos" as const, label: "Pagamentos" }] : [])]} /></View>}
    >
      <Card style={{ flexDirection: "row", gap: 14, alignItems: "flex-start" }}>
        <Avatar name={client.name} size={52} />
        <View style={{ flex: 1, gap: 8 }}>
          <View style={{ flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 8 }}>
            {age !== null && <Text color="ink2">{age} anos</Text>}
            <Pill accent={client.active} label={client.active ? "Ativo" : "Arquivado"} />
            {enrolled.map((m) => <ModalityTag key={m.id} modality={m.key} />)}
          </View>
          {client.phone && <Text variant="small" color="ink2">{client.phone}</Text>}
          {client.email && <Text variant="small" color="ink2">{client.email}</Text>}
          <Text variant="tiny" color="ink3">Rotina semanal · {slots.length}x por semana</Text>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
            {slots.length === 0 && <Text variant="small" color="ink2">Sem horários fixos</Text>}
            {slots.map((s) => <Pill key={s.id} accent label={`${weekdayName(s.weekday).slice(0, 3)} ${String(s.hour).padStart(2, "0")}:00${enrolled.length > 1 && modalityOf(s.modalityId) ? ` · ${modalityOf(s.modalityId)!.name}` : ""}`} />)}
          </View>
        </View>
      </Card>

      {tab === "dados" && <DataTab detail={q.data} enrolled={enrolled} />}
      {tab === "evolucoes" && <EvolutionsTab clientId={client.id} enrolled={enrolled} />}
      {tab === "pagamentos" && isAdmin && <ClientPaymentsTab clientId={client.id} />}
      {tab === "avaliacoes" && <EvaluationsTab clientId={client.id} enrolled={enrolled} openNew={nova as ModalityKey | undefined} />}
    </Screen>
  );
}
