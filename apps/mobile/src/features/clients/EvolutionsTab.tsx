import { listEvolutions, type Modality } from "@fluxo/api";
import { formatBR } from "@fluxo/domain";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { useState } from "react";
import { Pressable, View } from "react-native";
import { supabase } from "@/lib/supabase";
import { Banner } from "@/ui/Banner";
import { Button } from "@/ui/Button";
import { Card } from "@/ui/Card";
import { Empty } from "@/ui/Empty";
import { Icon } from "@/ui/Icon";
import { ModalityTag } from "@/ui/ModalityTag";
import { Seg } from "@/ui/Seg";
import { Text } from "@/ui/Text";
import { useTheme } from "@/ui/theme";

export function EvolutionsTab({ clientId, enrolled }: { clientId: string; enrolled: Modality[] }) {
  const theme = useTheme();
  const router = useRouter();
  const [mod, setMod] = useState("all");
  const [page, setPage] = useState(1);
  const filter = mod === "all" ? null : enrolled.find((m) => m.key === mod) ?? null;
  const many = enrolled.length > 1;

  const q = useQuery({ queryKey: ["evolutions", clientId, filter?.id ?? null, page], queryFn: () => listEvolutions(supabase, clientId, { modalityId: filter?.id, page }), placeholderData: keepPreviousData });
  const data = q.data;

  return (
    <View style={{ gap: 12 }}>
      {many && (
        <View style={{ marginHorizontal: -20 }}>
          <Seg label="Modalidade" value={mod} onChange={(m) => { setMod(m); setPage(1); }} items={[{ value: "all", label: "Todas" }, ...enrolled.map((m) => ({ value: m.key, label: m.name }))]} />
        </View>
      )}
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
        {enrolled.map((m) => (
          <Button key={m.id} label={many ? `Nova evolução · ${m.name}` : "Nova evolução"} onPress={() => router.push({ pathname: "/clientes/[id]/evolucoes/nova", params: { id: clientId, modalidade: m.key } })} />
        ))}
      </View>

      {q.isError && <Banner>{(q.error as Error).message}</Banner>}
      {q.isPending && <Text color="ink2">Carregando…</Text>}
      {data && data.items.length === 0 && <Empty title="Nenhuma evolução ainda">As evoluções registradas nas sessões aparecem aqui.</Empty>}

      {data?.items.map((e) => (
        <Pressable key={e.id} accessibilityRole="button" onPress={() => router.push({ pathname: "/clientes/[id]/evolucoes/[evoId]", params: { id: clientId, evoId: e.id } })}>
          <Card style={{ gap: 6 }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              <Text variant="small" color="ink2" style={{ fontWeight: "700" }}>Nº {e.sessionNumber}</Text>
              <Text variant="small" color="ink2" style={{ flex: 1 }}>{formatBR(e.date)}</Text>
              {many && e.modality && <ModalityTag modality={e.modality} />}
              <Icon name="chevr" size={18} color={theme.ink3} />
            </View>
            <Text variant="h3">{e.title}{e.extra > 0 ? ` · +${e.extra} ${e.extra === 1 ? "campo" : "campos"}` : ""}</Text>
            {e.text ? <Text variant="small" color="ink2" numberOfLines={2}>{e.text}</Text> : null}
          </Card>
        </Pressable>
      ))}

      {data && data.total > 0 && (
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
          <Text variant="small" color="ink2">{(data.page - 1) * 10 + 1} a {Math.min(data.page * 10, data.total)} de {data.total} {data.total === 1 ? "evolução" : "evoluções"}</Text>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
            <Pressable accessibilityRole="button" accessibilityLabel="Página anterior" disabled={data.page <= 1} onPress={() => setPage(data.page - 1)} hitSlop={10} style={{ opacity: data.page <= 1 ? 0.35 : 1 }}><Icon name="chevl" size={22} /></Pressable>
            <Text variant="small">{data.page} de {data.lastPage}</Text>
            <Pressable accessibilityRole="button" accessibilityLabel="Próxima página" disabled={data.page >= data.lastPage} onPress={() => setPage(data.page + 1)} hitSlop={10} style={{ opacity: data.page >= data.lastPage ? 0.35 : 1 }}><Icon name="chevr" size={22} /></Pressable>
          </View>
        </View>
      )}
    </View>
  );
}
