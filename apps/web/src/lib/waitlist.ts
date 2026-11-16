import { z } from "zod";

// Safe to import from client components.
export const PERIODS = ["MORNING", "AFTERNOON", "NIGHT"] as const;
export type Period = (typeof PERIODS)[number];

export const PERIOD_LABELS: Record<Period, string> = { MORNING: "Manhã", AFTERNOON: "Tarde", NIGHT: "Noite" };

// What goes in the URL: /espera?periodo=manha
export const PERIOD_SLUGS: Record<Period, string> = { MORNING: "manha", AFTERNOON: "tarde", NIGHT: "noite" };

export function periodFromSlug(slug: string | undefined): Period | null {
  return PERIODS.find((p) => PERIOD_SLUGS[p] === slug) ?? null;
}

export const waitSchema = z.object({
  name: z.string().trim().min(2, "Informe o nome.").max(120, "Nome muito longo."),
  phone: z
    .string()
    .trim()
    .max(40, "Telefone muito longo.")
    .refine((v) => v.replace(/\D/g, "").length >= 8, "Informe um telefone válido."),
  period: z.enum(PERIODS, { errorMap: () => ({ message: "Escolha o período." }) }),
  modalityId: z.string().uuid("Escolha a modalidade."),
});
