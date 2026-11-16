import { icons, type IconName } from "@fluxo/tokens";
import type { ColorValue } from "react-native";
import Svg, { Path } from "react-native-svg";
import { useTheme } from "./theme";

/** The design system's stroke icons, drawn from the same paths the web masks use. */
export function Icon({ name, size = 18, color }: { name: IconName; size?: number; color?: ColorValue }) {
  const theme = useTheme();
  const def = icons[name];
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      {def.paths.map((d, i) => (
        <Path key={i} d={d} stroke={color ?? theme.ink} strokeWidth={def.strokeWidth} strokeLinecap="round" strokeLinejoin="round" />
      ))}
    </Svg>
  );
}
