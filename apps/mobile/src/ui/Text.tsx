import { type } from "@fluxo/tokens";
import type { TypeName } from "@fluxo/tokens";
import { Text as RNText, type TextProps } from "react-native";
import { figtreeFamily } from "./fonts";
import { useTheme } from "./theme";

type Color = "ink" | "ink2" | "ink3" | "accent" | "accentInk";

/** Text in one of the design system's type styles (display, h1, h2, h3, body, small, tiny). */
export function Text({ variant = "body", color = "ink", style, ...rest }: TextProps & { variant?: TypeName; color?: Color }) {
  const theme = useTheme();
  const t: { fontSize: number; lineHeight: number; fontWeight?: number; letterSpacing?: number; uppercase?: boolean } = type[variant];
  return (
    <RNText
      {...rest}
      style={[
        {
          color: theme[color],
          fontFamily: figtreeFamily(t.fontWeight),
          fontSize: t.fontSize,
          lineHeight: t.lineHeight,
          // tokens store letter spacing in em; React Native wants px
          letterSpacing: t.letterSpacing !== undefined ? t.letterSpacing * t.fontSize : undefined,
          textTransform: t.uppercase ? "uppercase" : undefined,
        },
        style,
      ]}
    />
  );
}
