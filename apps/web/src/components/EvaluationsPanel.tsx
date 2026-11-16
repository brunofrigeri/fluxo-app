"use client";

import { useCallback, useState, useTransition } from "react";
import { editableData, getForm, type ModalityKey, type RecordData } from "@fluxo/forms";
import { deleteEvaluation, saveEvaluation } from "@/app/(app)/clientes/actions";
import { formatBR } from "@fluxo/domain";
import { EvaluationForm } from "./EvaluationForm";
import { Icon } from "./Icon";
import { Modal } from "./Modal";
import { ModalityTag } from "./ModalityTag";
import { Seg } from "./Seg";

export type EvaluationRow = { id: string; date: string; modality: ModalityKey; title: string; text: string; data: RecordData };
type Choice = { key: ModalityKey; name: string };
type Open = { id: string | null; modality: ModalityKey };

/**
 * The evaluations table and its dialog. Opening, closing and deleting are client state, so nothing
 * waits on the server (see CLAUDE.md); only Salvar does. The modality filter is a page navigation.
 */
export function EvaluationsPanel({
  clientId, rows, enrolled, filter, today, initialOpen, base,
}: {
  clientId: string;
  rows: EvaluationRow[];
  enrolled: Choice[];
  filter: ModalityKey | null;
  today: string;
  initialOpen: Open | null;
  base: string;
}) {
  const [open, setOpen] = useState<Open | null>(initialOpen);
  const [removed, setRemoved] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [, start] = useTransition();
  const close = useCallback(() => setOpen(null), []);

  const shown = rows.filter((r) => !removed.has(r.id));
  const current = open?.id ? shown.find((r) => r.id === open.id) ?? null : null;
  const many = enrolled.length > 1;
  const nameOf = (k: ModalityKey) => enrolled.find((m) => m.key === k)?.name;

  function remove(id: string) {
    if (!window.confirm("Excluir esta avaliação? Isso não pode ser desfeito.")) return;
    setError(null);
    setRemoved((s) => new Set(s).add(id));
    setOpen(null);
    start(async () => {
      try {
        await deleteEvaluation(clientId, id);
      } catch (e) {
        setRemoved((s) => {
          const next = new Set(s);
          next.delete(id);
          return next;
        });
        setError((e as Error).message);
      }
    });
  }

  return (
    <>
      <section className="card" style={{ padding: 0, overflow: "hidden" }}>
        <div className="row" style={{ padding: "18px 24px", justifyContent: "space-between" }}>
          <h2 className="t-h2">Avaliações</h2>
        </div>
        <div className="row" style={{ padding: "0 24px 16px", gap: 12, flexWrap: "wrap" }}>
          {many && (
            <Seg
              label="Modalidade"
              items={[
                { href: `${base}?aba=avaliacoes`, label: "Todas", on: !filter },
                ...enrolled.map((m) => ({ href: `${base}?aba=avaliacoes&modalidade=${m.key}`, label: m.name, on: filter === m.key })),
              ]}
            />
          )}
          <span style={{ marginLeft: "auto" }} />
          {enrolled.map((m) => (
            <button key={m.key} type="button" className="btn pri" onClick={() => setOpen({ id: null, modality: m.key })}>
              <Icon name="plus" size={16} />
              {many ? `Nova avaliação · ${m.name}` : "Nova avaliação"}
            </button>
          ))}
        </div>
        {error && <div className="errmsg" role="alert" style={{ margin: "0 24px 16px" }}>{error}</div>}

        {shown.length === 0 ? (
          <div className="empty" style={{ borderTop: "1px solid var(--line)" }}>
            <div className="badge"><Icon name="note" size={20} /></div>
            <b style={{ color: "var(--ink)" }}>Nenhuma avaliação ainda</b>
            <span className="t-small">Registre a avaliação inicial deste cliente.</span>
          </div>
        ) : (
          <div className="table-scroll">
            <table className="tbl">
              <thead>
                <tr>
                  <th>Avaliação</th>
                  <th style={{ width: 160 }}><span className="sortable">Data <Icon name="down" size={14} /></span></th>
                  <th style={{ width: 140, textAlign: "right" }}>Ações</th>
                </tr>
              </thead>
              <tbody>
                {shown.map((r) => (
                  <tr key={r.id}>
                    <td>
                      <button type="button" onClick={() => setOpen({ id: r.id, modality: r.modality })} style={{ all: "unset", cursor: "pointer", display: "block" }}>
                        <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
                          <span style={{ fontWeight: 600 }}>{r.title}</span>
                          {many && <ModalityTag modality={r.modality} />}
                        </div>
                        {r.text && <div className="t-small muted">{r.text}</div>}
                      </button>
                    </td>
                    <td>{formatBR(r.date)}</td>
                    <td style={{ textAlign: "right", whiteSpace: "nowrap" }}>
                      <button type="button" className="ibtn" aria-label="Ver detalhes" onClick={() => setOpen({ id: r.id, modality: r.modality })}><Icon name="eye" /></button>
                      <button type="button" className="ibtn" aria-label="Editar" onClick={() => setOpen({ id: r.id, modality: r.modality })}><Icon name="edit" /></button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <div className="row" style={{ padding: "14px 24px", borderTop: "1px solid var(--line)" }}>
          <span className="t-small muted">{shown.length} {shown.length === 1 ? "avaliação" : "avaliações"}</span>
        </div>
      </section>

      {open && (open.id === null || current) && (
        <Modal
          title={open.id === null ? `Nova avaliação${many && nameOf(open.modality) ? ` · ${nameOf(open.modality)}` : ""}` : `${current!.title}${many && nameOf(open.modality) ? ` · ${nameOf(open.modality)}` : ""} · ${formatBR(current!.date)}`}
          onClose={close}
        >
          <EvaluationForm
            key={current?.id ?? `nova-${open.modality}`}
            modality={open.modality}
            date={current ? current.date : today}
            data={current ? editableData(getForm(open.modality, "evaluation"), current.data) : {}}
            onClose={close}
            action={saveEvaluation.bind(null, clientId, open.modality, current ? current.id : null)}
            onDelete={
              current ? (
                <button type="button" className="btn quiet" onClick={() => remove(current.id)}>
                  Excluir
                </button>
              ) : null
            }
          />
        </Modal>
      )}
    </>
  );
}
