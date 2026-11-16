import type { ReactNode } from "react";
import { RefreshControl, ScrollView, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Text } from "./Text";
import { useTheme } from "./theme";

/**
 * A page: title (and subtitle), optional right-hand action, pull-to-refresh, bottom padding that clears the tab bar.
 * `scroll={false}` is for screens that bring their own list.
 */
export function Screen({ title, subtitle, right, children, refreshing, onRefresh, scroll = true, header }: {
  title?: string;
  subtitle?: string;
  right?: ReactNode;
  children: ReactNode;
  refreshing?: boolean;
  onRefresh?: () => void;
  scroll?: boolean;
  /** Extra content under the title, outside the scrolling area (filters, segmented controls). */
  header?: ReactNode;
}) {
  const theme = useTheme();
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
