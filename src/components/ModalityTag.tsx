import { MODALITY_LABELS, type ModalityKey } from "@fluxo/forms";

/** A modality's colour tag. With no modality it is a labelled one-off entry (see bookings.label). */
export function ModalityTag({ modality, label }: { modality: ModalityKey | null; label?: string | null }) {
  if (modality === null) return <span className="mod mod-label">{label || "Atividade"}</span>;
  return <span className={`mod mod-${modality}`}>{MODALITY_LABELS[modality]}</span>;
}
