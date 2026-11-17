import { View } from "react-native";
import { Text } from "./Text";

export function Empty({ title, children }: { title?: string; children?: string }) {
  return (
    <View style={{ alignItems: "center", gap: 4, paddingVertical: 24, paddingHorizontal: 12 }}>
      {title && <Text variant="h3" style={{ textAlign: "center" }}>{title}</Text>}
      {children && <Text variant="small" color="ink2" style={{ textAlign: "center" }}>{children}</Text>}
    </View>
  );
}
