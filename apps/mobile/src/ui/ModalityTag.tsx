import { MODALITY_LABELS, type ModalityKey } from "@fluxo/forms";
import { View } from "react-native";
import { Text } from "./Text";
import { useTheme } from "./theme";

/** A modality's colour tag. With no modality it is a labelled one-off entry (bookings.label). */
export function ModalityTag({ modality, label }: { modality: ModalityKey | null; label?: string | null }) {
  const theme = useTheme();
  const c = modality === "pilates" ? { bg: theme.mpBg, fg: theme.mpFg } : modality === "acupuncture" ? { bg: theme.maBg, fg: theme.maFg } : { bg: theme.stone, fg: theme.ink2 };
  return (
    <View style={{ alignSelf: "flex-start", height: 22, paddingHorizontal: 8, borderRadius: 6, justifyContent: "center", backgroundColor: c.bg }}>
      <Text variant="tiny" style={{ color: c.fg, letterSpacing: 0, textTransform: "none" }}>{modality ? MODALITY_LABELS[modality] : label || "Atividade"}</Text>
    </View>
  );
}
