import type { ReactNode } from "react";
import { useRouter } from "expo-router";
import { Pressable, RefreshControl, ScrollView, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Icon } from "./Icon";
import { Text } from "./Text";
import { useTheme } from "./theme";

/**
 * A page: title (and subtitle), optional right-hand action, pull-to-refresh, bottom padding that clears the tab bar.
 * `scroll={false}` is for screens that bring their own list.
 */
export function Screen({ title, subtitle, right, children, refreshing, onRefresh, scroll = true, header, back }: {
  title?: string;
  subtitle?: string;
  right?: ReactNode;
  children: ReactNode;
  refreshing?: boolean;
  onRefresh?: () => void;
  scroll?: boolean;
  /** Extra content under the title, outside the scrolling area (filters, segmented controls). */
  header?: ReactNode;
  /** Pushed screens show a back button. */
  back?: boolean;
}) {
  const theme = useTheme();
  const router = useRouter();
  const head = (title || right) && (
    <View style={{ flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: 12, paddingHorizontal: 20, paddingTop: 12, paddingBottom: 8 }}>
      <View style={{ flexShrink: 1, gap: 2 }}>
        {title && <Text variant="h1" accessibilityRole="header">{title}</Text>}
        {subtitle && <Text color="ink2">{subtitle}</Text>}
      </View>
      {right}
    </View>
  );
  return (
    <SafeAreaView edges={["top"]} style={{ flex: 1, backgroundColor: theme.bg }}>
      {back && (
        <Pressable accessibilityRole="button" accessibilityLabel="Voltar" onPress={() => (router.canGoBack() ? router.back() : router.replace("/"))} hitSlop={10} style={{ flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 16, paddingTop: 8 }}>
          <Icon name="chevl" size={20} color={theme.accent} />
        </Pressable>
      )}
      {head}
      {header}
      {scroll ? (
        <ScrollView
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ padding: 20, paddingTop: 12, gap: 16, paddingBottom: 40 }}
          refreshControl={onRefresh ? <RefreshControl refreshing={!!refreshing} onRefresh={onRefresh} /> : undefined}
        >
          {children}
        </ScrollView>
      ) : (
        <View style={{ flex: 1 }}>{children}</View>
      )}
    </SafeAreaView>
  );
}
