// Calendar vocabulary, Sunday first (index = JavaScript's getUTCDay()).
export const weekdayShort = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"] as const;
export const weekdayName = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"] as const;
/** Added to a weekday name on weekdays only: "Segunda-feira", but "Sábado". */
export const weekdaySuffix = "-feira";
export const monthName = [
  "janeiro", "fevereiro", "março", "abril", "maio", "junho",
  "julho", "agosto", "setembro", "outubro", "novembro", "dezembro",
] as const;

export const greetings = { morning: "Bom dia", afternoon: "Boa tarde", evening: "Boa noite" } as const;
