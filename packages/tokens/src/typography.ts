// Type tokens. Sizes and line heights are px (React Native dp); letterSpacing is in em.

export const fontFamily = {
  /** Loaded by each app (Google Fonts on web, expo-font on mobile). */
  sans: "Figtree",
  /** Web fallback stack. */
  sansStack: "'Figtree',system-ui,sans-serif",
} as const;

/** Body defaults on the app root. */
export const base = { fontSize: 15, lineHeight: 1.6 } as const;

export interface TextStyle {
  fontSize: number;
  lineHeight: number;
  /** Omitted: inherit the surrounding weight. */
  fontWeight?: number;
  letterSpacing?: number;
  uppercase?: boolean;
}

export const type = {
  display: { fontSize: 34, lineHeight: 42, fontWeight: 700, letterSpacing: -0.02 },
  h1: { fontSize: 28, lineHeight: 36, fontWeight: 700, letterSpacing: -0.015 },
  h2: { fontSize: 20, lineHeight: 28, fontWeight: 650, letterSpacing: -0.01 },
  h3: { fontSize: 16, lineHeight: 24, fontWeight: 650 },
  body: { fontSize: 15, lineHeight: 24 },
  small: { fontSize: 13, lineHeight: 20 },
  tiny: { fontSize: 12, lineHeight: 16, fontWeight: 600, letterSpacing: 0.04, uppercase: true },
} as const satisfies Record<string, TextStyle>;

export type TypeName = keyof typeof type;
