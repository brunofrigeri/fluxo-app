import type { AttendanceStatus } from "@fluxo/domain";
import { statusLabels, unmarkedLabel } from "@fluxo/copy";
import { View } from "react-native";
import { statusColors } from "./status";
import { Text } from "./Text";
import { useTheme } from "./theme";

/** Attendance status chip (same colors and wording as the web). */
export function StatusChip({ status }: { status: AttendanceStatus | null }) {
  const theme = useTheme();
  const c = statusColors(theme, status);
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 6, height: 28, paddingHorizontal: 10, borderRadius: 999, backgroundColor: c.bg, alignSelf: "flex-start" }}>
      <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: c.dot }} />
      <Text variant="small" style={{ color: c.fg }}>{status ? statusLabels[status] : unmarkedLabel}</Text>
    </View>
  );
}
