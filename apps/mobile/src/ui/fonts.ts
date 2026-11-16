// Figtree ships as one font file per weight on native, so the CSS weights the design uses (400-700, including 550 and
// 650) map to the nearest file the same way a browser would: round up.
export type FigtreeFamily = "Figtree_400Regular" | "Figtree_500Medium" | "Figtree_600SemiBold" | "Figtree_700Bold";

export function figtreeFamily(weight: number | undefined): FigtreeFamily {
  const w = weight ?? 400;
  if (w <= 400) return "Figtree_400Regular";
  if (w <= 500) return "Figtree_500Medium";
  if (w <= 600) return "Figtree_600SemiBold";
  return "Figtree_700Bold";
}
