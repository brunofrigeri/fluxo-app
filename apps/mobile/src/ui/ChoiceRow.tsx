import { Pressable, View } from "react-native";
import { Text } from "./Text";
import { useTheme } from "./theme";

/** Single choice as wrapped pills (selecting is local state). */
export function ChoiceRow<T extends string>({ items, value, onChange }: { items: { value: T; label: string }[]; value: T; onChange: (v: T) => void }) {
  const theme = useTheme();
  return (
    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
      {items.map((it) => {
        const on = it.value === value;
        return (
          <Pressable
            key={it.value}
            accessibilityRole="radio"
            accessibilityState={{ selected: on }}
            onPress={() => onChange(it.value)}
            style={{ minHeight: 40, paddingHorizontal: 14, borderRadius: 999, justifyContent: "center", borderWidth: 1, borderColor: on ? theme.accent : theme.line, backgroundColor: on ? theme.accentSoft : theme.surface }}
          >
            <Text variant="small" style={{ fontWeight: "600", color: on ? theme.accent : theme.ink }}>{it.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}
