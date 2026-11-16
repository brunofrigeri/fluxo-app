import { themes, type Theme } from "@fluxo/tokens";
import { useColorScheme } from "react-native";

/** Light or dark tokens, following the phone's setting. */
export function useTheme(): Theme {
  return useColorScheme() === "dark" ? themes.dark : themes.light;
}
