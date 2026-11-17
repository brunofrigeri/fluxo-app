import { getMe, getStudioModalities, getTeachableModalities, type Me, type Modality } from "@fluxo/api";
import { useQuery } from "@tanstack/react-query";
import { createContext, useContext, type ReactNode } from "react";
import { View } from "react-native";
import { Button } from "@/ui/Button";
import { Screen } from "@/ui/Screen";
import { Text } from "@/ui/Text";
import { useTheme } from "@/ui/theme";
import { auth } from "@fluxo/copy";
import { useSession } from "./session";
import { supabase } from "./supabase";

type Ready = { me: Me; studioModalities: Modality[]; teachable: Modality[]; isAdmin: boolean };
const Ctx = createContext<Ready | null>(null);

/** The signed-in person, their role and the modalities of their studio. Everything below can rely on it. */
export const useMe = (): Ready => {
  const v = useContext(Ctx);
  if (!v) throw new Error("useMe outside of MeGate");
  return v;
};

export function MeGate({ children }: { children: ReactNode }) {
  const { session } = useSession();
  const theme = useTheme();
  const q = useQuery({
    queryKey: ["me", session?.user.id],
    enabled: !!session,
    staleTime: 5 * 60_000,
    queryFn: async (): Promise<Ready | null> => {
      const me = await getMe(supabase);
      if (!me) return null;
      const [studioModalities, teachable] = await Promise.all([getStudioModalities(supabase), getTeachableModalities(supabase, me)]);
      return { me, studioModalities, teachable, isAdmin: me.role === "admin" };
    },
  });

  if (q.isPending) return <View style={{ flex: 1, backgroundColor: theme.bg }} />;

  if (q.isError || q.data === null) {
    return (
      <Screen title="Fluxo">
        <View style={{ gap: 12 }}>
          <Text variant="h2">{q.isError ? "Não foi possível carregar sua conta" : "Conta ainda não configurada"}</Text>
          <Text color="ink2">
            {q.isError
              ? (q.error as Error).message
              : "Entre uma vez no Fluxo pelo navegador para concluir o cadastro do seu estúdio, ou peça um convite ao administrador."}
          </Text>
          {q.isError && <Button label="Tentar de novo" kind="secondary" onPress={() => q.refetch()} />}
          <Button label={auth.signOut} kind="quiet" onPress={() => supabase.auth.signOut()} />
        </View>
      </Screen>
    );
  }
  return <Ctx.Provider value={q.data}>{children}</Ctx.Provider>;
}
