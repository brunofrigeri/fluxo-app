import { z, type ZodTypeAny } from "zod";
import { CUSTOM_KINDS } from "./customs";
import type { Field, FormDefinition, RecordData, Row, Section, Summary } from "./types";

const DATE = /^\d{4}-\d{2}-\d{2}$/;

export function allFields(def: FormDefinition): Field[] {
  return def.sections.flatMap((s) => s.fields);
}

function fieldSchema(f: Field): ZodTypeAny {
  switch (f.kind) {
    case "text":
      return z.string().trim().max(f.maxLength ?? 500);
    case "textarea":
      return z.string().trim().max(f.maxLength ?? 5000);
    case "choice":
      return z.enum(f.options.map((o) => o.value) as [string, ...string[]]);
    case "multichoice":
      return z.array(z.enum(f.options.map((o) => o.value) as [string, ...string[]]));
    case "boolean":
      return z.boolean();
    case "number": {
      let n = z.number().finite();
      if (f.min !== undefined) n = n.min(f.min);
      if (f.max !== undefined) n = n.max(f.max);
      return n;
    }
    case "date":
      return z.string().regex(DATE, "Data inválida.");
    case "rows":
      return z
        .array(z.object({ label: z.string().trim().max(120), value: z.string().trim().max(5000) }).strict())
        .max(f.maxRows ?? 50);
    case "custom":
      return CUSTOM_KINDS[f.custom].schema;
  }
}

/** Strict: a key the definition does not list is an error, never silently stored. */
export function buildSchema(def: FormDefinition) {
  const shape: Record<string, ZodTypeAny> = {};
  for (const f of allFields(def)) shape[f.key] = fieldSchema(f).optional();
  return z.object(shape).strict();
}

function isFilled(f: Field, v: unknown): boolean {
  if (v === undefined || v === null) return false;
  switch (f.kind) {
    case "text":
    case "textarea":
    case "date":
    case "choice":
      return typeof v === "string" && v !== "";
    case "multichoice":
      return Array.isArray(v) && v.length > 0;
    case "boolean":
      return typeof v === "boolean";
    case "number":
      return typeof v === "number";
    case "rows":
      // A label without a finding carries no information (suggested rows start with their label only).
      return Array.isArray(v) && v.some((r: Row) => r.value !== "");
    case "custom":
      return !CUSTOM_KINDS[f.custom].isEmpty(v);
  }
}

function tidy(f: Field, v: unknown): unknown {
  if (f.kind === "rows") return (v as Row[]).filter((r) => r.value !== "");
  if (f.kind === "custom") return CUSTOM_KINDS[f.custom].clean(v);
  return v;
}

export type ParseResult = { ok: true; data: RecordData } | { ok: false; error: string };

/** Validates what a client sent against the definition and drops every empty value. */
export function parseData(def: FormDefinition, raw: unknown): ParseResult {
  if (raw === null || typeof raw !== "object" || Array.isArray(raw)) return { ok: false, error: "Não foi possível ler os campos do formulário." };
  const parsed = buildSchema(def).safeParse(raw);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    if (issue.code === "unrecognized_keys") return { ok: false, error: `Campo desconhecido: ${issue.keys.join(", ")}.` };
    const field = allFields(def).find((f) => f.key === issue.path[0]);
    return { ok: false, error: field ? `Confira o campo "${field.label}".` : "Formulário inválido." };
  }
  const out: RecordData = {};
  for (const f of allFields(def)) {
    const v = (parsed.data as RecordData)[f.key];
    if (isFilled(f, v)) out[f.key] = tidy(f, v);
  }
  return { ok: true, data: out };
}

export function filledCount(def: FormDefinition, data: RecordData): number {
  return allFields(def).filter((f) => isFilled(f, data[f.key])).length;
}

export function isEmptyData(def: FormDefinition, data: RecordData): boolean {
  return filledCount(def, data) === 0;
}

/** What a form starts from when editing a saved record: older stored shapes are normalized, never rejected. */
export function editableData(def: FormDefinition, data: RecordData): RecordData {
  const out: RecordData = { ...data };
  for (const f of allFields(def)) {
    if (f.kind === "custom" && out[f.key] !== undefined) out[f.key] = CUSTOM_KINDS[f.custom].normalize(out[f.key]);
  }
  return out;
}

// ---------------------------------------------------------------- read view

export type ReadItem = { field: Field; value: unknown };
export type ReadSection = { id: string; title: string; items: ReadItem[] };

/** Only the filled fields, grouped by section. Sections with nothing filled are left out. */
export function readSections(def: FormDefinition, data: RecordData): ReadSection[] {
  const out: ReadSection[] = [];
  for (const s of def.sections as Section[]) {
    const items = s.fields.filter((f) => isFilled(f, data[f.key])).map((f) => ({ field: f, value: data[f.key] }));
    if (items.length > 0) out.push({ id: s.id, title: s.title, items });
  }
  return out;
}

/** Plain-text value of a simple field (choice label, "Sim"/"Não"...). Null for rows and custom kinds. */
export function displayValue(f: Field, value: unknown): string | null {
  switch (f.kind) {
    case "text":
    case "textarea":
    case "date":
      return typeof value === "string" ? value : null;
    case "choice":
      return f.options.find((o) => o.value === value)?.label ?? null;
    case "multichoice":
      return Array.isArray(value) ? f.options.filter((o) => value.includes(o.value)).map((o) => o.label).join(", ") : null;
    case "boolean":
      return typeof value === "boolean" ? (value ? "Sim" : "Não") : null;
    case "number":
      return typeof value === "number" ? String(value) : null;
    default:
      return null;
  }
}

// ---------------------------------------------------------------- list summary

function firstLine(text: string, max = 90): string {
  const line = text.split("\n")[0].trim();
  return line.length > max ? `${line.slice(0, max - 1)}…` : line;
}

export function summarize(def: FormDefinition, data: RecordData): Summary {
  if (def.summarize) return def.summarize(data);
  const first = allFields(def).find((f) => (f.kind === "text" || f.kind === "textarea") && isFilled(f, data[f.key]));
  const filled = filledCount(def, data);
  return {
    title: first ? firstLine(String(data[first.key])) : "Sem campos preenchidos",
    text: "",
    extra: Math.max(0, filled - 1),
  };
}

export { firstLine };
