import { View } from "react-native";
import { Text } from "./Text";
import { useTheme } from "./theme";

export function Pill({ label, accent }: { label: string; accent?: boolean }) {
  const theme = useTheme();
  return (
    <View style={{ alignSelf: "flex-start", height: 28, paddingHorizontal: 12, borderRadius: 999, justifyContent: "center", backgroundColor: accent ? theme.accentSoft : theme.stone }}>
      <Text variant="small" style={{ color: accent ? theme.accent : theme.ink2, fontWeight: "600" }}>{label}</Text>
    </View>
  );
}
