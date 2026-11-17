import { Tabs } from "expo-router";
import { Icon } from "@/ui/Icon";
import { useTheme } from "@/ui/theme";
import type { IconName } from "@fluxo/tokens";

const TABS: { name: string; title: string; icon: IconName }[] = [
  { name: "index", title: "Home", icon: "home" },
  { name: "agenda", title: "Agenda", icon: "calendar" },
  { name: "clientes", title: "Clientes", icon: "users" },
  { name: "espera", title: "Espera", icon: "clock" },
  { name: "mais", title: "Mais", icon: "dots" },
];

export default function TabsLayout() {
  const theme = useTheme();
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: theme.accent,
        tabBarInactiveTintColor: theme.ink3,
        tabBarStyle: { backgroundColor: theme.surface, borderTopColor: theme.line },
        tabBarLabelStyle: { fontFamily: "Figtree_600SemiBold", fontSize: 11 },
      }}
    >
      {TABS.map((t) => (
        <Tabs.Screen key={t.name} name={t.name} options={{ title: t.title, tabBarIcon: ({ color }) => <Icon name={t.icon} size={22} color={color} /> }} />
      ))}
    </Tabs>
  );
}
