import { listClients, type ClientSituation } from "@fluxo/api";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { Pressable, TextInput, View } from "react-native";
import { useMe } from "@/lib/me";
import { supabase } from "@/lib/supabase";
import { Avatar } from "@/ui/Avatar";
import { Banner } from "@/ui/Banner";
import { Button } from "@/ui/Button";
import { Card } from "@/ui/Card";
import { Empty } from "@/ui/Empty";
import { figtreeFamily } from "@/ui/fonts";
import { Icon } from "@/ui/Icon";
import { ModalityTag } from "@/ui/ModalityTag";
import { Pill } from "@/ui/Pill";
import { Screen } from "@/ui/Screen";
import { Seg } from "@/ui/Seg";
import { Text } from "@/ui/Text";
import { useTheme } from "@/ui/theme";

export default function Clientes() {
  const { studioModalities } = useMe();
  const theme = useTheme();
  const router = useRouter();
  const [text, setText] = useState("");
  const [q, setQ] = useState("");
  const [situation, setSituation] = useState<ClientSituation>("ativos");
  const [page, setPage] = useState(1);

  // Typing is instant; the search runs once the person pauses.
  useEffect(() => {
    const t = setTimeout(() => {
      setQ(text);
      setPage(1);
    }, 300);
    return () => clearTimeout(t);
  }, [text]);

  const query = useQuery({ queryKey: ["clients", q, situation, page], queryFn: () => listClients(supabase, { q, situation, page }), placeholderData: keepPreviousData });
  const data = query.data;
  const modalityKey = (id: string) => studioModalities.find((m) => m.id === id)?.key ?? null;

  return (
    <Screen
      title="Clientes"
      right={<Button label="Novo cliente" onPress={() => router.push("/clientes/novo")} />}
      refreshing={query.isRefetching}
      onRefresh={() => query.refetch()}
      header={
        <View style={{ gap: 10, paddingBottom: 4 }}>
          <View style={{ paddingHorizontal: 20 }}>
            <TextInput
              accessibilityLabel="Buscar por nome ou documento"
              placeholder="Buscar por nome ou documento"
              placeholderTextColor={theme.ink3}
              value={text}
              onChangeText={setText}
              autoCorrect={false}
              returnKeyType="search"
              style={{ height: 46, paddingHorizontal: 14, borderRadius: 12, borderWidth: 1, borderColor: theme.line, backgroundColor: theme.surface, color: theme.ink, fontSize: 15, fontFamily: figtreeFamily(400) }}
            />
          </View>
          <Seg label="Situação" value={situation} onChange={(s) => { setSituation(s); setPage(1); }} items={[{ value: "ativos", label: "Ativos" }, { value: "arquivados", label: "Arquivados" }]} />
        </View>
      }
    >
      {query.isError && <Banner>{(query.error as Error).message}</Banner>}
      {query.isPending && <Text color="ink2">Carregando…</Text>}

      {data && data.items.length === 0 && (
        <Empty title={q ? "Nenhum cliente encontrado" : situation === "ativos" ? "Nenhum cliente ainda" : "Nenhum cliente arquivado"}>
          {q ? "Tente buscar por outro nome ou documento." : "Os clientes cadastrados aparecem aqui."}
        </Empty>
      )}

      {data?.items.map((c) => (
        <Pressable key={c.id} accessibilityRole="button" accessibilityLabel={c.name} onPress={() => router.push(`/clientes/${c.id}`)}>
          <Card style={{ flexDirection: "row", alignItems: "center", gap: 12, opacity: c.active ? 1 : 0.65 }}>
            <Avatar name={c.name} size={40} />
            <View style={{ flex: 1, gap: 4 }}>
              <Text variant="h3">{c.name}</Text>
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6, alignItems: "center" }}>
                {studioModalities.length > 1 && c.modalityIds.map((id) => <ModalityTag key={id} modality={modalityKey(id)} />)}
                {!c.active && <Pill label="Arquivado" />}
              </View>
              {c.phone && <Text variant="small" color="ink2">{c.phone}</Text>}
              {c.active && <Text variant="small" color="ink2">{c.nextSession ?? "Sem sessão marcada"}{c.weeklyCount ? ` · ${c.weeklyCount}x por semana` : ""}</Text>}
            </View>
            <Icon name="chevr" size={18} color={theme.ink3} />
          </Card>
        </Pressable>
      ))}

      {data && data.total > 0 && (
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
          <Text variant="small" color="ink2">{(data.page - 1) * 10 + 1} a {Math.min(data.page * 10, data.total)} de {data.total} {data.total === 1 ? "cliente" : "clientes"}</Text>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
            <Pressable accessibilityRole="button" accessibilityLabel="Página anterior" disabled={data.page <= 1} onPress={() => setPage(data.page - 1)} hitSlop={10} style={{ opacity: data.page <= 1 ? 0.35 : 1 }}><Icon name="chevl" size={22} /></Pressable>
            <Text variant="small">{data.page} de {data.lastPage}</Text>
            <Pressable accessibilityRole="button" accessibilityLabel="Próxima página" disabled={data.page >= data.lastPage} onPress={() => setPage(data.page + 1)} hitSlop={10} style={{ opacity: data.page >= data.lastPage ? 0.35 : 1 }}><Icon name="chevr" size={22} /></Pressable>
          </View>
        </View>
      )}
      <Text variant="small" color="ink3">Clientes arquivados ficam esmaecidos e não recebem novos agendamentos.</Text>
    </Screen>
  );
}
