// Color and elevation tokens. The only place color values live: web and landing get them as CSS variables
// (generated into tokens.css), mobile imports them directly.
//
// Status pairs: bg = chip background, fg = text on it, dot = the small marker.
//   ok = present, jm = justified miss, um = unjustified miss, rp = replacement,
//   mp = modality Pilates, ma = modality Acupuntura.

export interface Theme {
  bg: string;
  surface: string;
  stone: string;
  stone2: string;
  line: string;
  lineStrong: string;
  ink: string;
  ink2: string;
  ink3: string;
  accent: string;
  accentInk: string;
  accentSoft: string;
  accentHover: string;
  okBg: string; okFg: string; okDot: string;
  jmBg: string; jmFg: string; jmDot: string;
  umBg: string; umFg: string; umDot: string;
  rpBg: string; rpFg: string; rpDot: string;
  mpBg: string; mpFg: string; mpDot: string;
  maBg: string; maFg: string; maDot: string;
  /** CSS box-shadow values. Mobile maps these to its own elevation. */
  shadow: string;
  shadowPop: string;
  /** Overlay behind modals. */
  scrim: string;
}

/** Default theme. */
export const light: Theme = {
  bg: "#F8F5F0",
  surface: "#FFFFFF",
  stone: "#F0ECE4",
  stone2: "#E7E1D6",
  line: "#E5DFD4",
  lineStrong: "#B9B2A3",
  ink: "#24271F",
  ink2: "#575B50",
  ink3: "#6A6E62",
  accent: "#2B6A63",
  accentInk: "#FFFFFF",
  accentSoft: "#DCEBE7",
  accentHover: "#235650",
  okBg: "#E3EFD6",
  okFg: "#2E5811",
  okDot: "#3F7A16",
  jmBg: "#EFE5D0",
  jmFg: "#664B17",
  jmDot: "#9C7623",
  umBg: "#F9DED7",
  umFg: "#8C2915",
  umDot: "#BC3E27",
  rpBg: "#DCEBE7",
  rpFg: "#1D5851",
  rpDot: "#2B6A63",
  mpBg: "#DCEBE7",
  mpFg: "#1D5851",
  mpDot: "#2B6A63",
  maBg: "#F3E1D6",
  maFg: "#7A3F22",
  maDot: "#B5623A",
  shadow: "0 1px 2px rgba(36,39,31,.05),0 6px 20px rgba(36,39,31,.05)",
  shadowPop: "0 2px 6px rgba(36,39,31,.08),0 18px 48px rgba(36,39,31,.16)",
  scrim: "rgba(36,39,31,.38)",
};

/** Dark theme. */
export const dark: Theme = {
  bg: "#151813",
  surface: "#1E211B",
  stone: "#262A23",
  stone2: "#30352D",
  line: "#33382F",
  lineStrong: "#585E52",
  ink: "#ECEAE2",
  ink2: "#B7BAAE",
  ink3: "#9DA196",
  accent: "#7CC4B7",
  accentInk: "#0E221E",
  accentSoft: "#213B36",
  accentHover: "#96D3C8",
  okBg: "#243418",
  okFg: "#BFE19A",
  okDot: "#8CC653",
  jmBg: "#3A3120",
  jmFg: "#E6CE98",
  jmDot: "#CBA45A",
  umBg: "#442220",
  umFg: "#F6B8AA",
  umDot: "#E3705A",
  rpBg: "#213B36",
  rpFg: "#A5DDD2",
  rpDot: "#7CC4B7",
  mpBg: "#213B36",
  mpFg: "#A5DDD2",
  mpDot: "#7CC4B7",
  maBg: "#43281B",
  maFg: "#F0C7B0",
  maDot: "#DE8A62",
  shadow: "0 1px 2px rgba(0,0,0,.3),0 6px 20px rgba(0,0,0,.25)",
  shadowPop: "0 2px 6px rgba(0,0,0,.4),0 18px 48px rgba(0,0,0,.5)",
  scrim: "rgba(0,0,0,.55)",
};

export const themes = { light, dark } as const;
export type ThemeName = keyof typeof themes;
