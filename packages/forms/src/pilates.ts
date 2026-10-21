import { summarizeApparatus } from "./apparatus";
import type { FormDefinition, RecordData } from "./types";

const str = (v: unknown) => (typeof v === "string" ? v : "");

export const pilatesEvaluation: FormDefinition = {
  modality: "pilates",
  kind: "evaluation",
  schemaVersion: 1,
  title: "Avaliação de Pilates",
  sections: [
    {
      id: "avaliacao",
      title: "Avaliação",
      fields: [
        { key: "diagnosis", kind: "text", label: "Diagnóstico" },
        { key: "main_complaint", kind: "text", label: "Queixa principal" },
        { key: "hdp", kind: "textarea", label: "HDP", help: "História da doença pregressa", rows: 3 },
        { key: "hda", kind: "textarea", label: "HDA", help: "História da doença atual", rows: 3 },
        { key: "medications", kind: "textarea", label: "Medicações", rows: 2 },
        { key: "movement_restrictions", kind: "textarea", label: "Restrições de movimento", rows: 2 },
        { key: "obs", kind: "textarea", label: "Observações", rows: 2 },
      ],
    },
  ],
  summarize: (d: RecordData) => ({ title: str(d.diagnosis), text: str(d.main_complaint), extra: 0 }),
};

export const pilatesEvolution: FormDefinition = {
  modality: "pilates",
  kind: "evolution",
  schemaVersion: 1,
  title: "Evolução de Pilates",
  sections: [
    {
      id: "aparelhos",
      title: "Aparelhos",
      fields: [{ key: "apparatus", kind: "custom", custom: "pilates-apparatus", label: "Aparelhos" }],
    },
  ],
  summarize: (d: RecordData) => summarizeApparatus(d.apparatus),
};

