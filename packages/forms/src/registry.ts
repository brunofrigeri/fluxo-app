import { acupunctureEvaluation, acupunctureEvolution } from "./acupuncture";
import type { ModalityKey } from "./modalities";
import { pilatesEvaluation, pilatesEvolution } from "./pilates";
import type { FormDefinition, FormKind } from "./types";

const FORMS: Record<ModalityKey, Record<FormKind, FormDefinition>> = {
  pilates: { evaluation: pilatesEvaluation, evolution: pilatesEvolution },
  acupuncture: { evaluation: acupunctureEvaluation, evolution: acupunctureEvolution },
};

export function getForm(modality: ModalityKey, kind: FormKind): FormDefinition {
  return FORMS[modality][kind];
}
