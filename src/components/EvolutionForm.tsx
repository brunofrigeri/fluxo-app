"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import type { FormState } from "@/app/(app)/clientes/actions";
import {
  APPARATUS_KEYS, APPARATUS_LABELS, EXERCISE_KEYS, EXERCISE_LABELS, REGION_KEYS, REGION_LABELS, countFields, normalizeTree,
  type Apparatus, type ApparatusKey, type Exercise, type ExerciseKey, type RegionKey,
} from "@/lib/apparatus";
import { Icon } from "./Icon";
import { SubmitButton } from "./SubmitButton";

export type SessionOption = { id: string; date: string; label: string };

type Props = {
  action: (prev: FormState, formData: FormData) => Promise<FormState>;
  cancelHref: string;
  initialDate: string;
  initialBookingId: string | null;
  initialTree: Apparatus;
  sessions: SessionOption[];
  extra?: React.ReactNode;
};

const EMPTY: Exercise = { regions: [] };

export function EvolutionForm({ action, cancelHref, initialDate, initialBookingId, initialTree, sessions, extra }: Props) {
  const [state, formAction] = useActionState(action, undefined);
  const [tree, setTree] = useState<Apparatus>(initialTree);
  const [date, setDate] = useState(initialDate);
  const [bookingId, setBookingId] = useState<string>(initialBookingId ?? "");
  const [open, setOpen] = useState<ApparatusKey | null>(() => APPARATUS_KEYS.find((k) => countFields(initialTree, k) > 0) ?? "reformer");
  const [exercise, setExercise] = useState<Record<ApparatusKey, ExerciseKey>>({
    reformer: "strengthening", barrel: "strengthening", cadillac: "strengthening", chair: "strengthening", balance: "strengthening",
  });

  const dirty =
    JSON.stringify(normalizeTree(tree)) !== JSON.stringify(normalizeTree(initialTree)) ||
    date !== initialDate ||
    bookingId !== (initialBookingId ?? "");
  const filled = countFields(tree);

  function update(a: ApparatusKey, e: ExerciseKey, patch: Partial<Exercise>) {
    setTree((prev) => ({ ...prev, [a]: { ...prev[a], [e]: { ...(prev[a]?.[e] ?? EMPTY), ...patch } } }));
  }

  function toggle(a: ApparatusKey, e: ExerciseKey, r: RegionKey) {
    const current = tree[a]?.[e]?.regions ?? [];
    const next = current.includes(r) ? current.filter((x) => x !== r) : [...current, r];
    update(a, e, { regions: REGION_KEYS.filter((k) => next.includes(k)) });
  }

  function chooseSession(id: string) {
    setBookingId(id);
    const s = sessions.find((x) => x.id === id);
    if (s) setDate(s.date);
  }

  return (
    <form action={formAction} style={{ display: "contents" }}>
      <input type="hidden" name="apparatus" value={JSON.stringify(tree)} />

      <div style={{ maxWidth: 880, display: "flex", flexDirection: "column", gap: 20 }}>
        <section className="card" style={{ display: "grid", gridTemplateColumns: "200px minmax(0, 1fr)", gap: 18, alignItems: "start" }}>
          <div className="field">
            <label className="label" htmlFor="date">Data</label>
            <input id="date" name="date" type="date" className="input" value={date} onChange={(e) => setDate(e.target.value)} required />
          </div>
          <div className="field">
            <label className="label" htmlFor="booking_id">Sessão vinculada <span className="faint" style={{ fontWeight: 400 }}>(opcional)</span></label>
            <select id="booking_id" name="booking_id" className="input" value={bookingId} onChange={(e) => chooseSession(e.target.value)}>
              <option value="">Sem sessão vinculada</option>
              {sessions.map((s) => (
                <option key={s.id} value={s.id}>{s.label}</option>
              ))}
            </select>
          </div>
          <p className="help" style={{ gridColumn: "1 / -1", display: "flex", alignItems: "center", gap: 8 }}>
            <Icon name="info" size={16} />
            Só é possível registrar evolução para quem esteve presente ou fez reposição.
          </p>
        </section>

        <div className="row" style={{ justifyContent: "space-between", marginTop: 4, flexWrap: "wrap" }}>
          <h2 className="t-h2">Aparelhos</h2>
          <span className="t-small muted">Todos os campos são opcionais. {filled} {filled === 1 ? "preenchido" : "preenchidos"}.</span>
        </div>

        {APPARATUS_KEYS.map((a) => {
          const isOpen = open === a;
          const count = countFields(tree, a);
          const current = exercise[a];
          const ex = tree[a]?.[current] ?? EMPTY;
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
                      const has = countFields({ [a]: { [e]: tree[a]?.[e] } }) > 0;
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

        {state?.error && <div className="errmsg" role="alert">{state.error}</div>}
      </div>

      <div className="stickybar">
        {dirty && (
          <span className="st st-jm" style={{ height: 32 }}>
            <Icon name="alert" size={16} />
            Alterações não salvas
          </span>
        )}
        {extra}
        <span style={{ marginLeft: "auto" }} />
        <Link className="btn" href={cancelHref}>Cancelar</Link>
        <div style={{ minWidth: 170 }}><SubmitButton pendingLabel="Salvando…" height={44}>Salvar evolução</SubmitButton></div>
      </div>
    </form>
  );
}
