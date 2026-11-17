import { View } from "react-native";
import { Text } from "./Text";
import { useTheme } from "./theme";

/** An inline error (or note) in the design's colors. */
export function Banner({ children, tone = "error" }: { children: string; tone?: "error" | "info" }) {
  const theme = useTheme();
  return (
    <View accessibilityRole={tone === "error" ? "alert" : undefined} style={{ padding: 12, borderRadius: 12, backgroundColor: tone === "error" ? theme.umBg : theme.jmBg }}>
      <Text variant="small" style={{ color: tone === "error" ? theme.umFg : theme.jmFg, fontWeight: "600" }}>{children}</Text>
    </View>
  );
}
