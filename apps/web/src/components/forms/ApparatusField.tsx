"use client";

import { useState } from "react";
import {
  APPARATUS_KEYS, APPARATUS_LABELS, EXERCISE_KEYS, EXERCISE_LABELS, REGION_KEYS, REGION_LABELS, countFields,
  type Apparatus, type ApparatusKey, type Exercise, type ExerciseKey, type RegionKey,
} from "@fluxo/forms";
import { Icon } from "@fluxo/ui-web";

const EMPTY: Exercise = { regions: [] };

/** The Pilates evolution tree: 5 apparatus x 3 exercise types, each with regions and a note. */
export function ApparatusField({ value, onChange }: { value: Apparatus; onChange: (next: Apparatus) => void }) {
  const [open, setOpen] = useState<ApparatusKey | null>(() => APPARATUS_KEYS.find((k) => countFields(value, k) > 0) ?? "reformer");
  const [exercise, setExercise] = useState<Record<ApparatusKey, ExerciseKey>>({
    reformer: "strengthening", barrel: "strengthening", cadillac: "strengthening", chair: "strengthening", balance: "strengthening",
  });
  const filled = countFields(value);

  function update(a: ApparatusKey, e: ExerciseKey, patch: Partial<Exercise>) {
    onChange({ ...value, [a]: { ...value[a], [e]: { ...(value[a]?.[e] ?? EMPTY), ...patch } } });
  }

  function toggle(a: ApparatusKey, e: ExerciseKey, r: RegionKey) {
    const current = value[a]?.[e]?.regions ?? [];
    const next = current.includes(r) ? current.filter((x) => x !== r) : [...current, r];
    update(a, e, { regions: REGION_KEYS.filter((k) => next.includes(k)) });
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <div className="row" style={{ justifyContent: "space-between", marginTop: 4, flexWrap: "wrap" }}>
        <h2 className="t-h2">Aparelhos</h2>
        <span className="t-small muted">Todos os campos são opcionais. {filled} {filled === 1 ? "preenchido" : "preenchidos"}.</span>
      </div>

      {APPARATUS_KEYS.map((a) => {
        const isOpen = open === a;
        const count = countFields(value, a);
        const current = exercise[a];
        const ex = value[a]?.[current] ?? EMPTY;
        return (
          <div key={a} className={`accord${isOpen ? " open" : ""}`}>
            <button
              type="button"
              className="h"
              aria-expanded={isOpen}
              onClick={() => setOpen(isOpen ? null : a)}
              style={{ width: "100%", border: 0, background: isOpen ? "var(--stone)" : "transparent", textAlign: "left", cursor: "pointer", fontSize: 15 }}
            >
              <Icon name={isOpen ? "chevd" : "chevr"} />
              {APPARATUS_LABELS[a]}
              {count > 0 && <span className="acc-count">{count} {count === 1 ? "campo" : "campos"}</span>}
            </button>
            {isOpen && (
              <div style={{ padding: 18, display: "flex", flexDirection: "column", gap: 16 }}>
                <div className="seg" role="tablist" style={{ alignSelf: "flex-start", flexWrap: "wrap" }}>
                  {EXERCISE_KEYS.map((e) => {
                    const has = countFields({ [a]: { [e]: value[a]?.[e] } }) > 0;
                    return (
                      <button key={e} type="button" role="tab" aria-selected={current === e} className={current === e ? "on" : ""} onClick={() => setExercise({ ...exercise, [a]: e })}>
                        {EXERCISE_LABELS[e]}
                        {has && <span aria-label="com conteúdo" style={{ width: 8, height: 8, borderRadius: "50%", background: "var(--accent)" }} />}
                      </button>
                    );
                  })}
                </div>

                <fieldset className="regions">
                  <legend className="label">Regiões trabalhadas</legend>
                  <div className="rchips">
                    {REGION_KEYS.map((r) => {
                      const id = `${a}-${current}-${r}`;
                      const on = ex.regions.includes(r);
                      return (
                        <label key={r} htmlFor={id} className={`rchip${on ? " on" : ""}`}>
                          <input id={id} type="checkbox" checked={on} onChange={() => toggle(a, current, r)} />
                          {on && <Icon name="check" size={14} />}
                          {REGION_LABELS[r]}
                        </label>
                      );
                    })}
                  </div>
                </fieldset>

                <div className="field">
                  <label className="label" htmlFor={`${a}-${current}-note`}>Detalhes <span className="faint" style={{ fontWeight: 400 }}>(opcional)</span></label>
                  <textarea
                    id={`${a}-${current}-note`}
                    className="input"
                    rows={3}
                    placeholder="Ex.: Footwork com 3 molas, 3 séries de 12"
                    value={ex.note ?? ""}
                    onChange={(ev) => update(a, current, { note: ev.target.value })}
                  />
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
