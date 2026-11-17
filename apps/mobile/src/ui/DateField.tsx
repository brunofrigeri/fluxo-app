import DateTimePicker from "@react-native-community/datetimepicker";
import { formatBR } from "@fluxo/domain";
import { useState } from "react";
import { Platform, Pressable, View } from "react-native";
import { Text } from "./Text";
import { useTheme } from "./theme";

/** "YYYY-MM-DD" <-> a Date at local noon (noon avoids a time-zone shift changing the calendar day). */
const toDate = (iso: string) => new Date(`${iso}T12:00:00`);
const toISO = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

/** A date field backed by the platform's native picker. Value is a plain calendar date, like everywhere in Fluxo. */
export function DateField({ label, value, onChange, optional }: { label: string; value: string; onChange: (iso: string) => void; optional?: boolean }) {
  const theme = useTheme();
  const [open, setOpen] = useState(false); // Android shows the picker as a dialog; iOS renders it inline
  const picker = (
    <DateTimePicker
      value={value ? toDate(value) : new Date()}
      mode="date"
      display={Platform.OS === "ios" ? "compact" : "default"}
      onChange={(_e, d) => {
        setOpen(false);
        if (d) onChange(toISO(d));
      }}
    />
  );
  return (
    <View style={{ gap: 6 }}>
      <Text variant="small" color="ink2" style={{ fontWeight: "600" }}>{label}</Text>
      {Platform.OS === "ios" ? (
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          {picker}
          {optional && value !== "" && <Pressable accessibilityRole="button" onPress={() => onChange("")}><Text variant="small" color="accent">Limpar</Text></Pressable>}
        </View>
      ) : (
        <>
          <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={() => setOpen(true)} style={{ height: 46, paddingHorizontal: 14, borderRadius: 12, borderWidth: 1, borderColor: theme.line, backgroundColor: theme.surface, justifyContent: "center" }}>
            <Text color={value ? "ink" : "ink3"}>{value ? formatBR(value) : "Escolher data"}</Text>
          </Pressable>
          {open && picker}
        </>
      )}
    </View>
  );
}
