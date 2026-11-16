import { periodLabels, waitlistMessages as msg } from "@fluxo/copy";
import { z } from "zod";

// Safe to import from client components.
export const PERIODS = ["MORNING", "AFTERNOON", "NIGHT"] as const;
export type Period = (typeof PERIODS)[number];

export const PERIOD_LABELS: Record<Period, string> = periodLabels;

// What goes in the URL: /espera?periodo=manha
export const PERIOD_SLUGS: Record<Period, string> = { MORNING: "manha", AFTERNOON: "tarde", NIGHT: "noite" };

export function periodFromSlug(slug: string | undefined): Period | null {
  return PERIODS.find((p) => PERIOD_SLUGS[p] === slug) ?? null;
}

export const waitSchema = z.object({
  name: z.string().trim().min(2, msg.nameRequired).max(120, msg.nameTooLong),
  phone: z
    .string()
    .trim()
    .max(40, msg.phoneTooLong)
    .refine((v) => v.replace(/\D/g, "").length >= 8, msg.phoneInvalid),
  period: z.enum(PERIODS, { errorMap: () => ({ message: msg.periodRequired }) }),
  modalityId: z.string().uuid(msg.modalityRequired),
});
