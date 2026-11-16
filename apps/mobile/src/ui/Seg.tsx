import { Pressable, ScrollView, View } from "react-native";
import { Text } from "./Text";
import { useTheme } from "./theme";

/** A segmented control. Selecting is local state: it never waits on anything. */
export function Seg<T extends string>({ items, value, onChange, label }: { items: { value: T; label: string }[]; value: T; onChange: (v: T) => void; label?: string }) {
  const theme = useTheme();
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 20 }} accessibilityLabel={label}>
      <View style={{ flexDirection: "row", padding: 3, borderRadius: 12, backgroundColor: theme.stone, gap: 2 }}>
        {items.map((it) => {
          const on = it.value === value;
          return (
            <Pressable
              key={it.value}
              accessibilityRole="radio"
              accessibilityState={{ selected: on }}
              onPress={() => onChange(it.value)}
              style={{ height: 36, paddingHorizontal: 14, borderRadius: 9, justifyContent: "center", backgroundColor: on ? theme.surface : "transparent" }}
            >
              <Text variant="small" style={{ fontWeight: "600", color: on ? theme.ink : theme.ink2 }}>{it.label}</Text>
            </Pressable>
          );
        })}
      </View>
    </ScrollView>
  );
}
