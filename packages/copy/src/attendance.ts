// Attendance statuses as users read them. The codes are in @fluxo/domain.
export const statusLabels = {
  PRESENCE_CONFIRMED: "Presença confirmada",
  JUSTIFIED_MISS: "Falta justificada",
  UNJUSTIFIED_MISS: "Falta não justificada",
  REPLACEMENT: "Reposição",
} as const;

export const unmarkedLabel = "Não marcado";
