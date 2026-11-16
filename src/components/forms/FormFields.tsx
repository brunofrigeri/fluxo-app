"use client";

import { Fragment } from "react";
import { TONGUE_ZONE_KEYS, TONGUE_ZONE_LABELS, normalizeTree, type Field, type FormDefinition, type RecordData, type Row, type Section } from "@fluxo/forms";
import { Icon } from "../Icon";
import { ApparatusField } from "./ApparatusField";

type Props = {
  def: FormDefinition;
  value: RecordData;
  onChange: (next: RecordData) => void;
  /** Keeps element ids unique when more than one form is on the page. */
  idPrefix?: string;
  /** Sections without the card around them, for use inside a modal. */
  plain?: boolean;
};

const FULL: Field["kind"][] = ["textarea", "rows", "custom", "multichoice", "boolean"];

function isFull(f: Field): boolean {
  return FULL.includes(f.kind) || (f.kind === "choice" && f.options.length > 3);
}

/** The one renderer for every form definition: sections, fields, groups. Adding a modality adds no screens. */
export function FormFields({ def, value, onChange, idPrefix = "f", plain = false }: Props) {
  const set = (key: string, v: unknown) => onChange({ ...value, [key]: v });

  // A form that is a single custom widget (the Pilates apparatus tree) draws it without a card around it.
  const bare = (s: Section) => s.fields.length === 1 && s.fields[0].kind === "custom" && s.fields[0].custom === "pilates-apparatus";

  return (
    <>
      {def.sections.map((section) =>
        bare(section) ? (
          <Fragment key={section.id}>
            <ApparatusField value={normalizeTree(value[section.fields[0].key], { trim: false })} onChange={(tree) => set(section.fields[0].key, tree)} />
          </Fragment>
        ) : (
          <section key={section.id} className={plain ? "fsec plain" : "card fsec"} aria-labelledby={`${idPrefix}-${section.id}`}>
            <h2 className="t-h2" id={`${idPrefix}-${section.id}`}>{section.title}</h2>
            {section.description && <p className="t-small muted">{section.description}</p>}
            <div className="form-grid">
              {section.fields.map((f, i) => {
                const prev = section.fields[i - 1];
                return (
                  <Fragment key={f.key}>
                    {f.group && f.group !== prev?.group && <div className="fgroup" style={{ gridColumn: "1 / -1" }}>{f.group}</div>}
                    <div className="field" style={isFull(f) ? { gridColumn: "1 / -1" } : undefined}>
                      <FieldInput f={f} id={`${idPrefix}-${f.key}`} value={value[f.key]} onChange={(v) => set(f.key, v)} />
                    </div>
                  </Fragment>
                );
              })}
            </div>
          </section>
        ),
      )}
    </>
  );
}

function Label({ f, id }: { f: Field; id: string }) {
  return (
    <>
      <label className="label" htmlFor={id}>{f.label}</label>
      {f.help && <span className="help" style={{ marginTop: -4 }}>{f.help}</span>}
    </>
  );
}

function FieldInput({ f, id, value, onChange }: { f: Field; id: string; value: unknown; onChange: (v: unknown) => void }) {
  switch (f.kind) {
    case "text":
      return (
        <>
          <Label f={f} id={id} />
          <input id={id} className="input" value={typeof value === "string" ? value : ""} maxLength={f.maxLength ?? 500} placeholder={f.placeholder} onChange={(e) => onChange(e.target.value)} />
        </>
      );
    case "textarea":
      return (
        <>
          <Label f={f} id={id} />
          <textarea id={id} className="input" rows={f.rows ?? 3} value={typeof value === "string" ? value : ""} maxLength={f.maxLength ?? 5000} placeholder={f.placeholder} onChange={(e) => onChange(e.target.value)} />
        </>
      );
    case "number":
      return (
        <>
          <Label f={f} id={id} />
          <input id={id} className="input" type="number" min={f.min} max={f.max} step={f.step} value={typeof value === "number" ? value : ""} onChange={(e) => onChange(e.target.value === "" ? undefined : Number(e.target.value))} />
        </>
      );
    case "date":
      return (
        <>
          <Label f={f} id={id} />
          <input id={id} className="input" type="date" value={typeof value === "string" ? value : ""} onChange={(e) => onChange(e.target.value)} />
        </>
      );
    case "choice":
      return (
        <>
          <span className="label" id={`${id}-l`}>{f.label}</span>
          {f.help && <span className="help" style={{ marginTop: -4 }}>{f.help}</span>}
          <div className="seg" role="radiogroup" aria-labelledby={`${id}-l`} style={{ alignSelf: "flex-start", flexWrap: "wrap" }}>
            {f.options.map((o) => (
              <button key={o.value} type="button" role="radio" aria-checked={value === o.value} className={value === o.value ? "on" : ""} onClick={() => onChange(value === o.value ? undefined : o.value)}>
                {o.label}
              </button>
            ))}
          </div>
        </>
      );
    case "multichoice": {
      const picked = Array.isArray(value) ? (value as string[]) : [];
      return (
        <fieldset className="regions">
          <legend className="label">{f.label}</legend>
          <div className="rchips">
            {f.options.map((o) => {
              const on = picked.includes(o.value);
              return (
                <label key={o.value} className={`rchip${on ? " on" : ""}`}>
                  <input type="checkbox" checked={on} onChange={() => onChange(on ? picked.filter((x) => x !== o.value) : [...picked, o.value])} />
                  {on && <Icon name="check" size={14} />}
                  {o.label}
                </label>
              );
            })}
          </div>
        </fieldset>
      );
    }
    case "boolean":
      return (
        <>
          <span className="label" id={`${id}-l`}>{f.label}</span>
          <div className="yn" role="radiogroup" aria-labelledby={`${id}-l`}>
            <button type="button" role="radio" aria-checked={value === true} className={value === true ? "on" : ""} onClick={() => onChange(value === true ? undefined : true)}>Sim</button>
            <button type="button" role="radio" aria-checked={value === false} className={value === false ? "on" : ""} onClick={() => onChange(value === false ? undefined : false)}>Não</button>
          </div>
        </>
      );
    case "rows":
      return <RowsInput f={f} id={id} value={value} onChange={onChange} />;
    case "custom":
      if (f.custom === "tongue-zones") return <TongueZones f={f} value={value} onChange={onChange} />;
      return null; // pilates-apparatus is drawn by FormFields as a whole section
  }
}

/** Repeating (label, value) rows. Suggested labels start as empty rows; rows without a value are dropped on save. */
function RowsInput({ f, id, value, onChange }: { f: Extract<Field, { kind: "rows" }>; id: string; value: unknown; onChange: (v: unknown) => void }) {
  const stored: Row[] = Array.isArray(value) ? (value as Row[]) : [];
  const missing = (f.suggestedLabels ?? []).filter((l) => !stored.some((r) => r.label === l)).map((label) => ({ label, value: "" }));
  const rows = [...stored, ...missing];
  const max = f.maxRows ?? 50;
  const replace = (i: number, patch: Partial<Row>) => onChange(rows.map((r, j) => (j === i ? { ...r, ...patch } : r)));

  return (
    <>
      <span className="label" id={`${id}-l`}>{f.label}</span>
      {f.help && <span className="help" style={{ marginTop: -4 }}>{f.help}</span>}
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }} role="group" aria-labelledby={`${id}-l`}>
        {rows.map((r, i) => (
          <div className="rowfield" key={i}>
            <input className="input" aria-label={`${f.label}, nome ${i + 1}`} value={r.label} maxLength={120} placeholder={f.labelPlaceholder ?? "Nome"} onChange={(e) => replace(i, { label: e.target.value })} />
            <textarea className="input rv" aria-label={`${f.label}, texto ${i + 1}`} rows={2} value={r.value} maxLength={5000} placeholder={f.valuePlaceholder ?? "Anotação"} onChange={(e) => replace(i, { value: e.target.value })} style={{ height: "auto", padding: "10px 14px" }} />
            <button type="button" className="ibtn" aria-label="Remover linha" onClick={() => onChange(rows.filter((_, j) => j !== i))}>
              <Icon name="x" size={16} />
            </button>
          </div>
        ))}
        {rows.length < max && (
          <button type="button" className="btn sm" style={{ alignSelf: "flex-start" }} onClick={() => onChange([...rows, { label: "", value: "" }])}>
            <Icon name="plus" size={16} />
            {f.addLabel ?? "Adicionar"}
          </button>
        )}
      </div>
    </>
  );
}

function TongueZones({ f, value, onChange }: { f: Field; value: unknown; onChange: (v: unknown) => void }) {
  const picked = Array.isArray(value) ? (value as string[]) : [];
  return (
    <fieldset className="regions">
      <legend className="label">{f.label}</legend>
      <div className="zones">
        {TONGUE_ZONE_KEYS.map((z) => {
          const on = picked.includes(z);
          return (
            <label key={z} className={`rchip${on ? " on" : ""}`}>
              <input type="checkbox" checked={on} onChange={() => onChange(on ? picked.filter((x) => x !== z) : [...picked, z])} />
              {on && <Icon name="check" size={14} />}
              {TONGUE_ZONE_LABELS[z]}
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}
