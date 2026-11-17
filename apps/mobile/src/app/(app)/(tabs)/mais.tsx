import { auth, roleLabels } from "@fluxo/copy";
import { useRouter } from "expo-router";
import { Pressable, View } from "react-native";
import { useMe } from "@/lib/me";
import { supabase } from "@/lib/supabase";
import { Avatar } from "@/ui/Avatar";
import { Button } from "@/ui/Button";
import { Card } from "@/ui/Card";
import { Icon } from "@/ui/Icon";
import { Pill } from "@/ui/Pill";
import { Screen } from "@/ui/Screen";
import { Text } from "@/ui/Text";
import { useTheme } from "@/ui/theme";
import type { IconName } from "@fluxo/tokens";

export default function More() {
  const { me, isAdmin } = useMe();
  const router = useRouter();
  const theme = useTheme();

  const items: { label: string; icon: IconName; to: "/usuarios" | "/configuracoes" }[] = isAdmin
    ? [{ label: "Usuários", icon: "shield", to: "/usuarios" }, { label: "Configurações", icon: "wave", to: "/configuracoes" }]
    : [];

  return (
    <Screen title="Mais">
      <Card style={{ flexDirection: "row", alignItems: "center", gap: 14 }}>
        <Avatar name={me.name} size={52} />
        <View style={{ flex: 1, gap: 4 }}>
          <Text variant="h3">{me.name}</Text>
          <Text variant="small" color="ink2">{me.email}</Text>
          <Pill accent={me.role === "admin"} label={roleLabels[me.role]} />
          {me.workingHours && <Text variant="small" color="ink2">{me.workingHours}</Text>}
        </View>
      </Card>

      {items.map((it) => (
        <Pressable key={it.to} accessibilityRole="button" onPress={() => router.push(it.to)}>
          <Card style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
            <Icon name={it.icon} size={20} color={theme.accent} />
            <Text variant="h3" style={{ flex: 1 }}>{it.label}</Text>
            <Icon name="chevr" size={18} color={theme.ink3} />
          </Card>
        </Pressable>
      ))}

      <Button kind="secondary" label={auth.signOut} onPress={() => supabase.auth.signOut()} />
    </Screen>
  );
}
