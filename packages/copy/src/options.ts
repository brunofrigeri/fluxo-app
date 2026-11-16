// Choices for the shared client fields. Values match the check constraints in migration 0011; labels are pt-BR.
export const SEX_OPTIONS = [
  { value: "female", label: "Feminino" },
  { value: "male", label: "Masculino" },
  { value: "other", label: "Outro" },
] as const;

export const MARITAL_OPTIONS = [
  { value: "single", label: "Solteiro(a)" },
  { value: "married", label: "Casado(a)" },
  { value: "stable_union", label: "União estável" },
  { value: "divorced", label: "Divorciado(a)" },
  { value: "widowed", label: "Viúvo(a)" },
] as const;
