import { getInstructorsByModality, type Modality } from "@fluxo/api";
import { useQuery } from "@tanstack/react-query";
import type { ModalityChoice } from "@/features/clients/ClientForm";
import { supabase } from "@/lib/supabase";

/** Who teaches what, for the "responsible instructor" pickers (admins see the studio; others only themselves). */
export function useModalityChoices(modalities: Modality[]): ModalityChoice[] {
  const q = useQuery({ queryKey: ["instructors-by-modality"], queryFn: () => getInstructorsByModality(supabase), staleTime: 5 * 60_000 });
  return modalities.map((m) => ({ id: m.id, key: m.key, name: m.name, instructors: q.data?.get(m.id) ?? [] }));
}
