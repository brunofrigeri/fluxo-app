import { Pressable } from "react-native";
import { Icon } from "./Icon";
import { Text } from "./Text";
import { useTheme } from "./theme";

/** A multi-select chip (checkbox semantics). */
export function ToggleChip({ label, on, onPress }: { label: string; on: boolean; onPress: () => void }) {
  const theme = useTheme();
  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityState={{ checked: on }}
      onPress={onPress}
      style={{ flexDirection: "row", alignItems: "center", gap: 6, minHeight: 40, paddingHorizontal: 14, borderRadius: 999, borderWidth: 1, borderColor: on ? theme.accent : theme.line, backgroundColor: on ? theme.accentSoft : theme.surface }}
    >
      {on && <Icon name="check" size={14} color={theme.accent} />}
      <Text variant="small" style={{ fontWeight: "600", color: on ? theme.accent : theme.ink }}>{label}</Text>
    </Pressable>
  );
}
