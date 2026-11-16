import { useState } from "react";
import { Pressable, TextInput, View } from "react-native";
import { figtreeFamily } from "./fonts";
import { Icon } from "./Icon";
import { Text } from "./Text";
import { useTheme } from "./theme";

/** Editable list of short texts (doenças, cirurgias...). Controlled: the parent saves it with the rest of the form. */
export function TagList({ title, items, onChange, placeholder }: { title: string; items: string[]; onChange: (next: string[]) => void; placeholder: string }) {
  const theme = useTheme();
  const [draft, setDraft] = useState("");
  function add() {
    const v = draft.trim();
    setDraft("");
    if (v && !items.includes(v)) onChange([...items, v]);
  }
  return (
    <View style={{ gap: 8 }}>
      <Text variant="h3">{title}</Text>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
        {items.length === 0 && <Text variant="small" color="ink2">Nada registrado.</Text>}
        {items.map((item) => (
          <View key={item} style={{ flexDirection: "row", alignItems: "center", gap: 6, minHeight: 32, paddingLeft: 12, paddingRight: 8, borderRadius: 999, backgroundColor: theme.stone }}>
            <Text variant="small" style={{ fontWeight: "600" }}>{item}</Text>
            <Pressable accessibilityRole="button" accessibilityLabel={`Remover ${item}`} onPress={() => onChange(items.filter((i) => i !== item))} hitSlop={8}>
              <Icon name="x" size={14} color={theme.ink2} />
            </Pressable>
          </View>
        ))}
      </View>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
        <TextInput
          accessibilityLabel={placeholder}
          placeholder={placeholder}
          placeholderTextColor={theme.ink3}
          value={draft}
          onChangeText={setDraft}
          onSubmitEditing={add}
          returnKeyType="done"
          style={{ flex: 1, height: 42, paddingHorizontal: 14, borderRadius: 12, borderWidth: 1, borderColor: theme.line, backgroundColor: theme.surface, color: theme.ink, fontSize: 15, fontFamily: figtreeFamily(400) }}
        />
        <Pressable accessibilityRole="button" accessibilityLabel="Adicionar" onPress={add} style={{ width: 42, height: 42, borderRadius: 12, alignItems: "center", justifyContent: "center", backgroundColor: theme.accentSoft }}>
          <Icon name="plus" size={18} color={theme.accent} />
        </Pressable>
      </View>
    </View>
  );
}
