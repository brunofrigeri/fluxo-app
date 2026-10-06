import { z } from "zod";

// The evolution tree: 5 apparatus x 3 exercise types. For each exercise type the admin picks the
// body regions that were worked (multiple choice) and can add a free-text note. Everything is optional.
export const APPARATUS_KEYS = ["reformer", "barrel", "cadillac", "chair", "balance"] as const;
export const EXERCISE_KEYS = ["mobility", "strengthening", "stretching"] as const;
export const REGION_KEYS = ["mmii", "mmss", "trunk", "core", "cervical", "hip", "shoulder_girdle", "global"] as const;

export type ApparatusKey = (typeof APPARATUS_KEYS)[number];
export type ExerciseKey = (typeof EXERCISE_KEYS)[number];
export type RegionKey = (typeof REGION_KEYS)[number];

export const APPARATUS_LABELS: Record<ApparatusKey, string> = {
  reformer: "Reformer",
  barrel: "Barrel",
  cadillac: "Cadillac",
  chair: "Chair",
  balance: "Balance",
};

export const EXERCISE_LABELS: Record<ExerciseKey, string> = {
  mobility: "Mobilidade",
  strengthening: "Fortalecimento",
  stretching: "Alongamento",
};

export const REGION_LABELS: Record<RegionKey, string> = {
  mmii: "MMII",
  mmss: "MMSS",
  trunk: "Tronco",
  core: "Core",
  cervical: "Cervical",
  hip: "Quadril",
  shoulder_girdle: "Cintura escapular",
  global: "Global",
};

const exercise = z.object({
  regions: z.array(z.enum(REGION_KEYS)),
  note: z.string().optional(),
});

const exercises = z.object({
  mobility: exercise.optional(),
  strengthening: exercise.optional(),
  stretching: exercise.optional(),
});

export const apparatusSchema = z.object({
  reformer: exercises.optional(),
  barrel: exercises.optional(),
  cadillac: exercises.optional(),
  chair: exercises.optional(),
  balance: exercises.optional(),
});

export type Apparatus = z.infer<typeof apparatusSchema>;
export type Exercise = z.infer<typeof exercise>;

// Evolutions saved before the regions existed had free text per area. They are read as regions + note.
const LEGACY_AREAS: Record<string, RegionKey> = { inferiors: "mmii", superiors: "mmss", global: "global" };

function readExercise(ex: Record<string, unknown>): { regions: RegionKey[]; note: string } {
  if ("regions" in ex || "note" in ex) {
    const picked: unknown[] = Array.isArray(ex.regions) ? ex.regions : [];
    return {
      regions: REGION_KEYS.filter((k) => picked.includes(k)),
      note: typeof ex.note === "string" ? ex.note.trim() : "",
    };
  }
  const found = new Set<RegionKey>();
  const notes: string[] = [];
  for (const [area, region] of Object.entries(LEGACY_AREAS)) {
    const text = typeof ex[area] === "string" ? (ex[area] as string).trim() : "";
    if (text) {
      found.add(region);
      notes.push(text);
    }
  }
  return { regions: REGION_KEYS.filter((k) => found.has(k)), note: notes.join("\n") };
}

/** Anything stored or sent (new or old shape) -> the current shape, without empty branches. */
export function normalizeTree(raw: unknown): Apparatus {
  const out: Apparatus = {};
  if (!raw || typeof raw !== "object") return out;
  for (const a of APPARATUS_KEYS) {
    const node = (raw as Record<string, unknown>)[a];
    if (!node || typeof node !== "object") continue;
    for (const e of EXERCISE_KEYS) {
      const ex = (node as Record<string, unknown>)[e];
      if (!ex || typeof ex !== "object") continue;
      const { regions, note } = readExercise(ex as Record<string, unknown>);
      if (regions.length === 0 && !note) continue;
      out[a] = out[a] ?? {};
      out[a]![e] = note ? { regions, note } : { regions };
    }
  }
  return out;
}

/** Validate what the form sends, then drop everything empty. */
export function cleanTree(raw: unknown): Apparatus {
  return normalizeTree(apparatusSchema.parse(raw));
}

export type Leaf = { apparatus: ApparatusKey; exercise: ExerciseKey; regions: RegionKey[]; note: string };

/** Every filled exercise type, in reading order. */
export function leaves(raw: unknown): Leaf[] {
  const tree = normalizeTree(raw);
  const out: Leaf[] = [];
  for (const a of APPARATUS_KEYS) {
    for (const e of EXERCISE_KEYS) {
      const ex = tree[a]?.[e];
      if (ex) out.push({ apparatus: a, exercise: e, regions: ex.regions, note: ex.note ?? "" });
    }
  }
  return out;
}

export function countFields(raw: unknown, apparatus?: ApparatusKey): number {
  const all = leaves(raw);
  return apparatus ? all.filter((l) => l.apparatus === apparatus).length : all.length;
}

/** Title and first note, for lists: "Reformer · Fortalecimento · MMII, Quadril". */
export function summarize(raw: unknown): { title: string; text: string; extra: number } {
  const all = leaves(raw);
  if (all.length === 0) return { title: "Evolução sem campos preenchidos", text: "", extra: 0 };
  const first = all[0];
  const parts = [APPARATUS_LABELS[first.apparatus], EXERCISE_LABELS[first.exercise]];
  if (first.regions.length > 0) parts.push(first.regions.map((r) => REGION_LABELS[r]).join(", "));
  return { title: parts.join(" · "), text: first.note, extra: all.length - 1 };
}
