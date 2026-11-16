import { Pressable, type PressableProps } from "react-native";
import { Text } from "./Text";
import { useTheme } from "./theme";

/** Primary (accent) or secondary (outlined) button, 44pt tall like the web's. */
export function Button({ label, kind = "primary", disabled, ...rest }: Omit<PressableProps, "children"> & { label: string; kind?: "primary" | "secondary" | "quiet" }) {
  const theme = useTheme();
  const primary = kind === "primary";
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: !!disabled }}
      disabled={disabled}
      {...rest}
      style={({ pressed }) => ({
        height: 44,
        paddingHorizontal: 18,
        borderRadius: 12,
        alignItems: "center",
        justifyContent: "center",
        borderWidth: 1,
        borderColor: primary ? theme.accent : kind === "quiet" ? "transparent" : theme.lineStrong,
        backgroundColor: primary ? (pressed ? theme.accentHover : theme.accent) : pressed ? theme.stone : "transparent",
        opacity: disabled ? 0.45 : 1,
      })}
    >
      <Text variant="h3" color={primary ? "accentInk" : kind === "quiet" ? "accent" : "ink"}>{label}</Text>
    </Pressable>
  );
}
