import { z } from "zod";

// Tongue zones for the acupuncture forms. Our own simple list, not a copy of the paper diagram.
export const TONGUE_ZONE_KEYS = [
  "heart_pericardium",
  "lung",
  "gallbladder",
  "spleen_pancreas",
  "stomach",
  "liver",
  "large_intestine",
  "small_intestine",
  "bladder",
  "kidney",
  "ming_men",
] as const;

export type TongueZoneKey = (typeof TONGUE_ZONE_KEYS)[number];

export const TONGUE_ZONE_LABELS: Record<TongueZoneKey, string> = {
  heart_pericardium: "Coração-Pericárdio",
  lung: "Pulmão",
  gallbladder: "Vesícula biliar",
  spleen_pancreas: "Baço-Pâncreas",
  stomach: "Estômago",
  liver: "Fígado",
  large_intestine: "Intestino grosso",
  small_intestine: "Intestino delgado",
  bladder: "Bexiga",
  kidney: "Rim",
  ming_men: "Ming men (raiz)",
};

export const tongueZonesSchema = z.array(z.enum(TONGUE_ZONE_KEYS));

/** Dedupes and puts the zones in the canonical order. */
export function cleanTongueZones(raw: unknown): TongueZoneKey[] {
  const picked = tongueZonesSchema.parse(raw);
  return TONGUE_ZONE_KEYS.filter((k) => picked.includes(k));
}
