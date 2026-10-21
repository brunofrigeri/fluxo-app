import { firstLine } from "./schema";
import type { Field, FormDefinition, RecordData } from "./types";

const str = (v: unknown) => (typeof v === "string" ? v : "");
const long = (key: string, label: string, extra: Partial<Field> = {}): Field => ({ key, kind: "textarea", label, rows: 2, ...extra }) as Field;
const short = (key: string, label: string, extra: Partial<Field> = {}): Field => ({ key, kind: "text", label, ...extra }) as Field;

// Follows the owner's paper form. Socio-demographic data, surgeries, treatments and medication are
// client data (see the client's Dados), so they are not repeated here. Signature lines are not built:
// the author is recorded automatically (created_by).
export const acupunctureEvaluation: FormDefinition = {
  modality: "acupuncture",
  kind: "evaluation",
  schemaVersion: 1,
  title: "Avaliação de Acupuntura",
  sections: [
    {
      id: "queixa",
      title: "Queixa principal",
      fields: [long("main_complaint", "O que te trouxe até a acupuntura?", { rows: 3 })],
    },
    {
      id: "compleicao",
      title: "Compleição e inspeção",
      fields: [
        {
          key: "constitution",
          kind: "choice",
          label: "Compleição geral",
          options: [
            { value: "yin", label: "Yin" },
            { value: "yang", label: "Yang" },
          ],
        },
        long("general_inspection", "Inspeção geral"),
      ],
    },
    {
      id: "corpo",
      title: "Aspectos gerais do corpo",
      fields: [long("posture", "Postura"), long("locomotion", "Locomoção")],
    },
    {
      id: "interrogatorio",
      title: "Interrogatório geral",
      fields: [
        long("breathing", "Respiração"),
        long("sleep", "Sono"),
        long("diet", "Alimentação"),
        long("physical_activity", "Hábitos de atividade física regular"),
        long("religiosity", "Religiosidade/prática"),
        long("tastes", "Sabores"),
        long("emotions", "Emoções"),
        long("thirst", "Sede"),
        long("gi_dysfunctions", "Disfunções gastrointestinais"),
        long("excretions", "Excreções"),
        long("work", "Trabalho"),
        long("leisure", "Lazer"),
        long("menstrual_cycle", "Ciclo menstrual"),
      ],
    },
    {
      id: "dor",
      title: "Processos dolorosos",
      fields: [
        long("physical_pain_location", "Localização da dor física"),
        short("emotional_globus", "Bolo na garganta", { group: "Características da dor emocional" }),
        short("emotional_anguish", "Angústia", { group: "Características da dor emocional" }),
        short("emotional_chest_pain", "Dor ou queimação no peito", { group: "Características da dor emocional" }),
        short("emotional_head_pressure", "Pressão na cabeça", { group: "Características da dor emocional" }),
        short("emotional_fears", "Medos e inseguranças", { group: "Características da dor emocional" }),
        short("emotional_grief", "Dor da perda", { group: "Características da dor emocional" }),
        short("emotional_frustration", "Frustração", { group: "Características da dor emocional" }),
        short("emotional_anxiety", "Ansiedade/preocupação/agitação mental", { group: "Características da dor emocional" }),
        short("emotional_anger", "Raiva, irritabilidade, rancor, mágoa, ira, ódio", { group: "Características da dor emocional" }),
        short("emotional_sadness", "Tristeza, melancolia", { group: "Características da dor emocional" }),
        {
          key: "emotional_other",
          kind: "rows",
          label: "Outro",
          group: "Características da dor emocional",
          maxRows: 1,
          addLabel: "Adicionar outro",
          labelPlaceholder: "Qual?",
          valuePlaceholder: "Característica",
        },
      ],
    },
    {
      id: "palpacao",
      title: "Palpação",
      fields: [{ key: "palpation", kind: "rows", label: "Achados da palpação", addLabel: "Adicionar achado", labelPlaceholder: "Local", valuePlaceholder: "Achado" }],
    },
    {
      id: "pulsologia",
      title: "Pulsologia chinesa",
      fields: [
        short("pulse_right_1", "Triplo aquecedor e Circulação-sexualidade", { group: "Punho direito" }),
        short("pulse_right_2", "Estômago e Baço-pâncreas", { group: "Punho direito" }),
        short("pulse_right_3", "Intestino grosso e Pulmão", { group: "Punho direito" }),
        short("pulse_left_1", "Bexiga e Rim", { group: "Punho esquerdo" }),
        short("pulse_left_2", "Vesícula biliar e Fígado", { group: "Punho esquerdo" }),
        // TODO(owner): the third left position is cut off in the scan of the paper form. Confirm the label.
        short("pulse_left_3", "Intestino delgado e Coração", { group: "Punho esquerdo" }),
        long("pulse_notes", "Observações"),
      ],
    },
    {
      id: "lingua",
      title: "Língua",
      fields: [
        { key: "tongue_zones", kind: "custom", custom: "tongue-zones", label: "Zonas da língua" },
        long("tongue_notes", "Observações"),
      ],
    },
    {
      id: "elementos",
      title: "5 elementos/correlações",
      fields: [
        {
          key: "five_elements",
          kind: "rows",
          label: "Notas por elemento",
          suggestedLabels: ["Fogo", "Terra", "Metal", "Água", "Madeira"],
          addLabel: "Adicionar nota",
          labelPlaceholder: "Elemento",
          valuePlaceholder: "Nota",
        },
      ],
    },
    {
      id: "diagnostico",
      title: "Diagnóstico de Medicina Tradicional Chinesa",
      fields: [long("tcm_diagnosis", "Diagnóstico", { rows: 3 })],
    },
    {
      id: "plano",
      title: "Plano de tratamento, Localizações",
      fields: [
        short("plan_acupuncture", "Acupuntura"),
        short("plan_gua_sha", "Guashá"),
        short("plan_auriculotherapy", "Auriculomedicina"),
        short("plan_cupping", "Ventosa"),
        short("plan_other", "Outros"),
      ],
    },
  ],
  summarize: (d: RecordData) => ({ title: "", text: str(d.main_complaint), extra: 0 }),
};

export const acupunctureEvolution: FormDefinition = {
  modality: "acupuncture",
  kind: "evolution",
  schemaVersion: 1,
  title: "Evolução, Medicina Tradicional Chinesa Integrativa",
  sections: [
    {
      id: "sessao",
      title: "Sessão",
      fields: [
        long("previous_session_perception", "Percepção da sessão anterior"),
        long("current_complaint", "Queixa atual"),
        short("tongue", "Língua"),
        short("pulse_initial", "Pulso inicial"),
        short("pulse_final", "Pulso final"),
        long("conducts", "Condutas", { rows: 3 }),
      ],
    },
  ],
  summarize: (d: RecordData) => ({
    title: firstLine(str(d.current_complaint)) || firstLine(str(d.conducts)) || "Evolução de acupuntura",
    text: str(d.conducts),
    extra: 0,
  }),
};
