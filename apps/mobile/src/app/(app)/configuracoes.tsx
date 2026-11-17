import { getModalities, getStudioModalities, setStudioModality, type Modality } from "@fluxo/api";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Redirect } from "expo-router";
import { Switch, View } from "react-native";
import { useMe } from "@/lib/me";
import { supabase } from "@/lib/supabase";
import { useToast } from "@/lib/toast";
import { Banner } from "@/ui/Banner";
import { Card } from "@/ui/Card";
import { Screen } from "@/ui/Screen";
import { Text } from "@/ui/Text";
import { useTheme } from "@/ui/theme";

export default function Settings() {
  const { me, isAdmin } = useMe();
  const theme = useTheme();
  const qc = useQueryClient();
  const toast = useToast();

  const q = useQuery({
    queryKey: ["settings-modalities"],
    enabled: isAdmin,
    queryFn: async () => {
      const [all, enabled] = await Promise.all([getModalities(supabase), getStudioModalities(supabase)]);
      return { all, on: enabled.map((m) => m.id) };
    },
  });

  // Optimistic: the switch flips at once and flips back with a message if the server refuses
  // (for example, a modality with enrolled clients cannot be switched off).
  const toggle = useMutation({
    mutationFn: async ({ id, enabled }: { id: string; enabled: boolean }) => {
      const r = await setStudioModality(supabase, me, id, enabled);
      if (r.error) throw new Error(r.error);
    },
    onMutate: async ({ id, enabled }) => {
      await qc.cancelQueries({ queryKey: ["settings-modalities"] });
      const previous = qc.getQueryData<{ all: Modality[]; on: string[] }>(["settings-modalities"]);
      qc.setQueryData<{ all: Modality[]; on: string[] }>(["settings-modalities"], (d) => d && { ...d, on: enabled ? [...new Set([...d.on, id])] : d.on.filter((x) => x !== id) });
      return { previous };
    },
    onError: (e, _v, ctx) => {
      qc.setQueryData(["settings-modalities"], ctx?.previous);
      toast(e.message);
    },
    onSettled: () => {
      // everything that lists modalities
      for (const k of ["settings-modalities", "me", "instructors-by-modality", "waitlist", "agenda", "home", "clients"]) qc.invalidateQueries({ queryKey: [k] });
    },
  });

  if (!isAdmin) return <Redirect href="/" />;

  return (
    <Screen back title="Configurações">
      <Card style={{ gap: 16 }}>
        <View style={{ gap: 4 }}>
          <Text variant="h2">Modalidades</Text>
          <Text variant="small" color="ink2">Escolha o que o estúdio oferece. Cada modalidade tem a própria agenda, avaliação e evolução. Uma modalidade só pode ser desativada quando nenhum cliente está inscrito nela.</Text>
        </View>
        {q.isError && <Banner>{(q.error as Error).message}</Banner>}
        {q.isPending && <Text color="ink2">Carregando…</Text>}
        {q.data?.all.map((m) => (
          <View key={m.id} style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
            <Text variant="h3">{m.name}</Text>
            <Switch value={q.data.on.includes(m.id)} onValueChange={(enabled) => toggle.mutate({ id: m.id, enabled })} trackColor={{ true: theme.accent }} accessibilityLabel={m.name} />
          </View>
        ))}
        <Text variant="small" color="ink3">Depois de ativar uma modalidade, marque quem a ensina em Usuários.</Text>
      </Card>
    </Screen>
  );
}
