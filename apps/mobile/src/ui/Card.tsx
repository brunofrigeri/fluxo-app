import type { ReactNode } from "react";
import { View, type ViewStyle } from "react-native";
import { useTheme } from "./theme";

export function Card({ children, style, flat }: { children: ReactNode; style?: ViewStyle; flat?: boolean }) {
  const theme = useTheme();
  return (
    <View style={[{ borderRadius: 16, borderWidth: 1, borderColor: theme.line, backgroundColor: theme.surface, padding: 16, gap: 12 }, flat && { backgroundColor: theme.stone, borderColor: "transparent" }, style]}>
      {children}
    </View>
  );
}
