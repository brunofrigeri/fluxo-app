import type { ModalityKey } from "./modalities";

export type FormKind = "evaluation" | "evolution";

export type Option = { value: string; label: string };

type Base = {
  /** Key in the stored `data` object. Stable: renaming it needs a schema_version bump. */
  key: string;
  label: string;
  help?: string;
  /** Fields that share a `group` are drawn under one small heading, in order. */
  group?: string;
};

/** A (label, value) pair, used by repeating rows (palpation, five elements, "Outro"). */
export type Row = { label: string; value: string };

export type CustomKind = "pilates-apparatus" | "tongue-zones";

export type Field =
  | (Base & { kind: "text"; maxLength?: number; placeholder?: string })
  | (Base & { kind: "textarea"; maxLength?: number; rows?: number; placeholder?: string })
  | (Base & { kind: "choice"; options: Option[] })
  | (Base & { kind: "multichoice"; options: Option[] })
  | (Base & { kind: "boolean" })
  | (Base & { kind: "number"; min?: number; max?: number; step?: number })
  | (Base & { kind: "date" })
  | (Base & {
      kind: "rows";
      /** Labels offered as one-tap starting rows (the five elements). The person can still add more. */
      suggestedLabels?: string[];
      /** Upper bound on rows. 1 = the single "Outro" row. */
      maxRows?: number;
      addLabel?: string;
      labelPlaceholder?: string;
      valuePlaceholder?: string;
    })
  | (Base & { kind: "custom"; custom: CustomKind });

export type Section = { id: string; title: string; description?: string; fields: Field[] };

export type Summary = { title: string; text: string; extra: number };

export type FormDefinition = {
  modality: ModalityKey;
  kind: FormKind;
  /** Stored next to `data`. Bump it when a field is renamed or changes meaning. */
  schemaVersion: number;
  title: string;
  sections: Section[];
  /** What the list table shows for a saved record. Falls back to the first filled text field. */
  summarize?: (data: RecordData) => Summary;
};

/** The `data` jsonb of one saved record. */
export type RecordData = Record<string, unknown>;
