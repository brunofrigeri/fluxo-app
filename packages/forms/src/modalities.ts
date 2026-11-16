// Code-owned modalities. Each one also has a seed row in the `modalities` table (migration 0009),
// keyed by the same `key`. Adding a modality = a new key here, a seed row, and its form definitions.
export const MODALITY_KEYS = ["pilates", "acupuncture"] as const;
export type ModalityKey = (typeof MODALITY_KEYS)[number];

export const MODALITY_LABELS: Record<ModalityKey, string> = {
  pilates: "Pilates",
  acupuncture: "Acupuntura",
};

/** A tone from the design system (see .mod-* in packages/ui-web/fluxo.css), used for chips and tags. */
export const MODALITY_TONES: Record<ModalityKey, "pilates" | "acupuncture"> = {
  pilates: "pilates",
  acupuncture: "acupuncture",
};

export function isModalityKey(value: unknown): value is ModalityKey {
  return typeof value === "string" && (MODALITY_KEYS as readonly string[]).includes(value);
}
