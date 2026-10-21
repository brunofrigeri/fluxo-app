import type { ZodTypeAny } from "zod";
import { apparatusSchema, cleanTree, normalizeTree } from "./apparatus";
import { TONGUE_ZONE_KEYS, cleanTongueZones, tongueZonesSchema } from "./tongue";
import type { CustomKind } from "./types";

type Custom = {
  schema: ZodTypeAny;
  /** Validated value -> the value to store (normalized, without empty branches). */
  clean: (value: unknown) => unknown;
  /** Lenient: turns anything stored (including older shapes) into a value the form can start from. */
  normalize: (value: unknown) => unknown;
  isEmpty: (value: unknown) => boolean;
};

/** Field kinds that need their own widget on every platform. */
export const CUSTOM_KINDS: Record<CustomKind, Custom> = {
  "pilates-apparatus": {
    schema: apparatusSchema,
    clean: cleanTree,
    normalize: normalizeTree,
    isEmpty: (v) => !v || typeof v !== "object" || Object.keys(v).length === 0,
  },
  "tongue-zones": {
    schema: tongueZonesSchema,
    clean: cleanTongueZones,
    normalize: (v) => (Array.isArray(v) ? TONGUE_ZONE_KEYS.filter((k) => v.includes(k)) : []),
    isEmpty: (v) => !Array.isArray(v) || v.length === 0,
  },
};
