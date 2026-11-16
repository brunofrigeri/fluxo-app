import { initialsOf } from "@fluxo/domain";
import { View } from "react-native";
import { Text } from "./Text";
import { useTheme } from "./theme";

export function Avatar({ name, size = 36 }: { name: string; size?: number }) {
  const theme = useTheme();
  return (
    <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: theme.accentSoft, alignItems: "center", justifyContent: "center" }}>
      <Text variant="small" style={{ color: theme.accent, fontWeight: "700", fontSize: size * 0.36, lineHeight: size * 0.5 }}>{initialsOf(name)}</Text>
    </View>
  );
}
