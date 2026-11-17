// Payment wording as the studio reads it. The codes are in @fluxo/domain.
export const paymentLabels = {
  paid: "Pago",
  unpaid: "Não pago",
  pending: "Sem registro",
  overdue: "Em atraso",
  upcoming: "A vencer",
} as const;

export const paymentCopy = {
  title: "Pagamentos",
  billingDay: "Dia do pagamento",
  billingDayHelp: "Dia do mês em que o cliente paga o estúdio. Em meses mais curtos, vale o último dia.",
  billingDayRequired: "Informe o dia do pagamento (de 1 a 31).",
  markPaid: "Marcar como pago",
  markUnpaid: "Marcar como não pago",
  clear: "Desfazer registro",
  receipt: "Comprovante",
  addReceipt: "Anexar comprovante",
  paidOn: "Pago em",
  homeTitle: "Pagamentos sem atualização",
  homeEmpty: "Nenhum pagamento em atraso.",
  filterChip: "Pagamentos",
} as const;
