import {
  APPARATUS_KEYS, APPARATUS_LABELS, EXERCISE_LABELS, REGION_LABELS, TONGUE_ZONE_LABELS, countFields, displayValue, leaves, readSections,
  type FormDefinition, type RecordData, type Row, type TongueZoneKey,
} from "@fluxo/forms";
import { Icon } from "@fluxo/ui-web";

/** Read-only view of a saved record: only the filled fields, section by section. */
export function FormReadView({ def, data }: { def: FormDefinition; data: RecordData }) {
  const sections = readSections(def, data);
  if (sections.length === 0) return <p className="t-body muted" style={{ padding: "22px 0" }}>Nenhum campo preenchido.</p>;

  return (
    <>
      {sections.map((section) => {
        const apparatus = section.items.find((i) => i.field.kind === "custom" && i.field.custom === "pilates-apparatus");
        if (apparatus) return <ApparatusRead key={section.id} value={apparatus.value} />;
        return (
          <section key={section.id} className="card" style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <h2 className="t-h2">{section.title}</h2>
            {section.items.map(({ field, value }, i) => {
              const prev = section.items[i - 1]?.field;
              return (
                <div key={field.key} style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                  {field.group && field.group !== prev?.group && <div className="fgroup">{field.group}</div>}
                  <div className="t-small muted">{field.label}</div>
                  <Value field={field} value={value} />
                </div>
              );
            })}
          </section>
        );
      })}
    </>
  );
}

function Value({ field, value }: { field: FormDefinition["sections"][number]["fields"][number]; value: unknown }) {
  if (field.kind === "rows") {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {(value as Row[]).map((r, i) => (
          <p key={i} className="t-body" style={{ whiteSpace: "pre-wrap" }}>
            {r.label && <b>{r.label}: </b>}
            {r.value}
          </p>
        ))}
      </div>
    );
  }
  if (field.kind === "custom" && field.custom === "tongue-zones") {
    return (
      <div className="row" style={{ flexWrap: "wrap", gap: 8 }}>
        {(value as TongueZoneKey[]).map((z) => (
          <span key={z} className="tag" style={{ paddingRight: 12 }}>{TONGUE_ZONE_LABELS[z]}</span>
        ))}
      </div>
    );
  }
  return <p className="t-body" style={{ whiteSpace: "pre-wrap" }}>{displayValue(field, value)}</p>;
}

function ApparatusRead({ value }: { value: unknown }) {
  const all = leaves(value);
  const total = countFields(value);
  const shown = APPARATUS_KEYS.filter((a) => all.some((l) => l.apparatus === a));
  return (
    <>
      <section className="card" style={{ display: "flex", flexDirection: "column", gap: 0, padding: "8px 28px" }}>
        {shown.map((a, i) => (
          <div key={a} style={{ display: "grid", gridTemplateColumns: "minmax(110px, 180px) minmax(0, 1fr)", gap: 24, padding: "22px 0", borderBottom: i < shown.length - 1 ? "1px solid var(--line)" : undefined }}>
            <h2 className="t-h2">{APPARATUS_LABELS[a]}</h2>
            <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
              {all.filter((l) => l.apparatus === a).map((l) => (
                <div key={l.exercise}>
                  <span className="pill acc">{EXERCISE_LABELS[l.exercise]}</span>
                  {l.regions.length > 0 && (
                    <div className="row" style={{ flexWrap: "wrap", gap: 8, marginTop: 10 }}>
                      {l.regions.map((r) => (
                        <span key={r} className="tag" style={{ paddingRight: 12 }}>{REGION_LABELS[r]}</span>
                      ))}
                    </div>
                  )}
                  {l.note && <p className="t-body" style={{ marginTop: 10, whiteSpace: "pre-wrap" }}>{l.note}</p>}
                </div>
              ))}
            </div>
          </div>
        ))}
      </section>
      <p className="t-small muted row" style={{ gap: 8 }}>
        <Icon name="info" size={16} />
        Mostrando só os {total} {total === 1 ? "campo preenchido" : "campos preenchidos"}. Os demais aparelhos não foram usados nesta sessão.
      </p>
    </>
  );
}

