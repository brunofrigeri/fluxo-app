import { TextInput, View, type TextInputProps } from "react-native";
import { figtreeFamily } from "./fonts";
import { Text } from "./Text";
import { useTheme } from "./theme";

export function TextField({ label, help, error, multiline, style, ...rest }: TextInputProps & { label: string; help?: string; error?: boolean }) {
  const theme = useTheme();
  return (
    <View style={{ gap: 6 }}>
      <Text variant="small" color="ink2" style={{ fontWeight: "600" }}>{label}</Text>
      {help && <Text variant="small" color="ink3">{help}</Text>}
      <TextInput
        accessibilityLabel={label}
        placeholderTextColor={theme.ink3}
        multiline={multiline}
        {...rest}
        style={[
          { minHeight: multiline ? 88 : 46, paddingHorizontal: 14, paddingVertical: multiline ? 12 : 0, borderRadius: 12, borderWidth: 1, borderColor: error ? theme.umDot : theme.line, backgroundColor: theme.surface, color: theme.ink, fontSize: 15, fontFamily: figtreeFamily(400), textAlignVertical: multiline ? "top" : "center" },
          style,
        ]}
      />
    </View>
  );
}
