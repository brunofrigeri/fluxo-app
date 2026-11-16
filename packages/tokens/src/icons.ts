// Icon paths on a 24x24 grid, drawn as strokes (round caps and joins, no fill).
// Web renders them as CSS masks (generated into tokens.css); mobile draws them with react-native-svg.
export interface IconDef {
  /** Stroke width on the 24x24 grid. */
  strokeWidth: number;
  /** SVG path `d` strings. */
  paths: readonly string[];
}

export const icons = {
  home: { strokeWidth: 1.8, paths: ["M3 11l9-8 9 8M5 10v10h14V10M10 20v-5h4v5"] },
  calendar: { strokeWidth: 1.8, paths: ["M4 6h16v14H4zM4 10h16M8 3v4M16 3v4"] },
  users: { strokeWidth: 1.8, paths: ["M9 11a3.5 3.5 0 100-7 3.5 3.5 0 000 7zM2.5 20c0-3.3 2.9-6 6.5-6s6.5 2.7 6.5 6M17 4.5a3 3 0 010 6M18 14c2.2.5 3.5 2.4 3.5 5"] },
  check: { strokeWidth: 2.4, paths: ["M5 12.5l4.5 4.5L19 7.5"] },
  calx: { strokeWidth: 1.9, paths: ["M4 6h16v14H4zM4 10h16M8 3v4M16 3v4M10 13.5l4 4M14 13.5l-4 4"] },
  x: { strokeWidth: 2.4, paths: ["M6 6l12 12M18 6L6 18"] },
  repeat: { strokeWidth: 2.2, paths: ["M4 11V9a3 3 0 013-3h12M16 3l3 3-3 3M20 13v2a3 3 0 01-3 3H5M8 21l-3-3 3-3"] },
  chevl: { strokeWidth: 2, paths: ["M14.5 6l-6 6 6 6"] },
  chevr: { strokeWidth: 2, paths: ["M9.5 6l6 6-6 6"] },
  chevd: { strokeWidth: 2, paths: ["M6 9.5l6 6 6-6"] },
  plus: { strokeWidth: 2, paths: ["M12 5v14M5 12h14"] },
  search: { strokeWidth: 1.9, paths: ["M11 18a7 7 0 100-14 7 7 0 000 14zM20 20l-4-4"] },
  eye: { strokeWidth: 1.8, paths: ["M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12zM12 15a3 3 0 100-6 3 3 0 000 6z"] },
  eyeoff: { strokeWidth: 1.8, paths: ["M3 3l18 18M10.6 5.1A10 10 0 0112 5c6.5 0 10 7 10 7a17 17 0 01-3.2 4M6.5 6.8C3.6 8.6 2 12 2 12s3.5 7 10 7c1.7 0 3.2-.4 4.5-1M9.9 9.9a3 3 0 004.2 4.2"] },
  edit: { strokeWidth: 1.8, paths: ["M4 20h4L19 9l-4-4L4 16v4zM13.5 6.5l4 4"] },
  logout: { strokeWidth: 1.8, paths: ["M10 4H5v16h5M15 8l4 4-4 4M19 12H9"] },
  cake: { strokeWidth: 1.8, paths: ["M4 20h16v-7H4zM4 16.5c2 0 2 1.5 4 1.5s2-1.5 4-1.5 2 1.5 4 1.5 2-1.5 4-1.5M12 13V9M12 6v.01"] },
  alert: { strokeWidth: 1.9, paths: ["M12 4l9 16H3zM12 10v4M12 17v.01"] },
  clock: { strokeWidth: 1.8, paths: ["M12 21a9 9 0 100-18 9 9 0 000 18zM12 7v5l3 2"] },
  archive: { strokeWidth: 1.8, paths: ["M3 5h18v4H3zM5 9v10h14V9M10 13h4"] },
  phone: { strokeWidth: 1.8, paths: ["M6 3h4l2 5-2.5 1.5a11 11 0 005 5L16 12l5 2v4a2 2 0 01-2 2A16 16 0 013 5a2 2 0 013-2z"] },
  mail: { strokeWidth: 1.8, paths: ["M3 6h18v12H3zM3 7l9 7 9-7"] },
  sun: { strokeWidth: 1.8, paths: ["M12 16a4 4 0 100-8 4 4 0 000 8zM12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"] },
  moon: { strokeWidth: 1.8, paths: ["M20 14.5A8 8 0 019.5 4 8 8 0 1020 14.5z"] },
  shield: { strokeWidth: 1.8, paths: ["M12 3l7 3v5c0 4.5-3 8.3-7 10-4-1.7-7-5.5-7-10V6zM9 12l2.2 2.2L15.5 10"] },
  lock: { strokeWidth: 1.9, paths: ["M5 11h14v9H5zM8 11V8a4 4 0 018 0v3"] },
  dots: { strokeWidth: 3, paths: ["M5 12h.01M12 12h.01M19 12h.01"] },
  down: { strokeWidth: 2, paths: ["M12 5v14M6 13l6 6 6-6"] },
  up: { strokeWidth: 2, paths: ["M12 19V5M6 11l6-6 6 6"] },
  note: { strokeWidth: 1.8, paths: ["M6 3h9l4 4v14H6zM9 12h7M9 16h7"] },
  wave: { strokeWidth: 2.2, paths: ["M3 9c3-5 6-5 9 0s6 5 9 0M3 15.5c3-5 6-5 9 0s6 5 9 0"] },
  refresh: { strokeWidth: 1.9, paths: ["M20 11a8 8 0 00-14.5-4M4 5v3.5h3.5M4 13a8 8 0 0014.5 4M20 19v-3.5h-3.5"] },
  info: { strokeWidth: 1.9, paths: ["M12 21a9 9 0 100-18 9 9 0 000 18zM12 11v5M12 8v.01"] },
} as const satisfies Record<string, IconDef>;

export type IconName = keyof typeof icons;
