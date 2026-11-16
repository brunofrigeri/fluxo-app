import { deleteEvaluation, listEvaluations, saveEvaluation, type EvaluationItem, type Modality } from "@fluxo/api";
import { formatBR, todayISO } from "@fluxo/domain";
import { editableData, getForm, type ModalityKey, type RecordData } from "@fluxo/forms";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Alert, Pressable, View } from "react-native";
import { FormFields } from "@/forms/FormFields";
import { supabase } from "@/lib/supabase";
import { useToast } from "@/lib/toast";
import { Banner } from "@/ui/Banner";
import { Button } from "@/ui/Button";
import { Card } from "@/ui/Card";
import { DateField } from "@/ui/DateField";
import { Empty } from "@/ui/Empty";
import { Icon } from "@/ui/Icon";
import { ModalityTag } from "@/ui/ModalityTag";
import { Seg } from "@/ui/Seg";
import { Sheet } from "@/ui/Sheet";
import { Text } from "@/ui/Text";
import { useTheme } from "@/ui/theme";

type Open = { id: string | null; modality: ModalityKey };

export function EvaluationsTab({ clientId, enrolled, openNew }: { clientId: string; enrolled: Modality[]; /** Arrival from creating an Acupuncture client: open the new-evaluation form once. */ openNew?: ModalityKey | null }) {
  const theme = useTheme();
  const qc = useQueryClient();
  const toast = useToast();
  const [mod, setMod] = useState("all");
  const [open, setOpen] = useState<Open | null>(openNew && enrolled.some((m) => m.key === openNew) ? { id: null, modality: openNew } : null);
  const filter = mod === "all" ? null : enrolled.find((m) => m.key === mod) ?? null;
  const many = enrolled.length > 1;
  const key = ["evaluations", clientId, filter?.id ?? null];

  const q = useQuery({ queryKey: key, queryFn: () => listEvaluations(supabase, clientId, filter?.id) });
  const rows = q.data ?? [];
  const current = open?.id ? (rows.find((r) => r.id === open.id) ?? null) : null;
  const nameOf = (k: ModalityKey) => enrolled.find((m) => m.key === k)?.name;

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const r = await deleteEvaluation(supabase, clientId, id);
      if (r.error) throw new Error(r.error);
    },
    onMutate: async (id) => {
      await qc.cancelQueries({ queryKey: ["evaluations", clientId] });
      const previous = qc.getQueryData<EvaluationItem[]>(key);
      qc.setQueryData<EvaluationItem[]>(key, (d) => d?.filter((x) => x.id !== id));
      return { previous };
    },
    onError: (e, _id, ctx) => {
      qc.setQueryData(key, ctx?.previous);
      toast(e.message);
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ["evaluations", clientId] }),
  });

  const confirmRemove = (id: string) =>
    Alert.alert("Excluir esta avaliação?", "Isso não pode ser desfeito.", [
      { text: "Cancelar", style: "cancel" },
      { text: "Excluir", style: "destructive", onPress: () => { setOpen(null); remove.mutate(id); } },
    ]);

  return (
    <View style={{ gap: 12 }}>
      {many && (
        <View style={{ marginHorizontal: -20 }}>
          <Seg label="Modalidade" value={mod} onChange={setMod} items={[{ value: "all", label: "Todas" }, ...enrolled.map((m) => ({ value: m.key, label: m.name }))]} />
        </View>
      )}
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
        {enrolled.map((m) => (
          <Button key={m.id} label={many ? `Nova avaliação · ${m.name}` : "Nova avaliação"} onPress={() => setOpen({ id: null, modality: m.key })} />
        ))}
      </View>

      {q.isError && <Banner>{(q.error as Error).message}</Banner>}
      {q.isPending && <Text color="ink2">Carregando…</Text>}
      {q.data && rows.length === 0 && <Empty title="Nenhuma avaliação ainda">Registre a avaliação inicial deste cliente.</Empty>}

      {rows.map((r) => (
        <Pressable key={r.id} accessibilityRole="button" onPress={() => setOpen({ id: r.id, modality: r.modality })}>
          <Card style={{ gap: 6 }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              <Text variant="h3" style={{ flex: 1 }}>{r.title}</Text>
              {many && <ModalityTag modality={r.modality} />}
              <Icon name="chevr" size={18} color={theme.ink3} />
            </View>
            <Text variant="small" color="ink2">{formatBR(r.date)}</Text>
            {r.text ? <Text variant="small" color="ink2" numberOfLines={2}>{r.text}</Text> : null}
          </Card>
        </Pressable>
      ))}
      <Text variant="small" color="ink2">{rows.length} {rows.length === 1 ? "avaliação" : "avaliações"}</Text>

      <EvaluationSheet
        open={!!open && (open.id === null || !!current)}
        onClose={() => setOpen(null)}
        clientId={clientId}
        modality={open?.modality ?? null}
        title={open ? (open.id === null ? `Nova avaliação${many && nameOf(open.modality) ? ` · ${nameOf(open.modality)}` : ""}` : `${current?.title ?? ""}${many && nameOf(open.modality) ? ` · ${nameOf(open.modality)}` : ""}`) : ""}
        current={current}
        onDelete={current ? () => confirmRemove(current.id) : undefined}
      />
    </View>
  );
}

function EvaluationSheet({ open, onClose, clientId, modality, title, current, onDelete }: { open: boolean; onClose: () => void; clientId: string; modality: ModalityKey | null; title: string; current: EvaluationItem | null; onDelete?: () => void }) {
  const qc = useQueryClient();
  const [date, setDate] = useState(todayISO());
  const [data, setData] = useState<RecordData>({});
  const [error, setError] = useState<string | null>(null);

  // Fresh values each time the sheet opens: today and empty for a new one, the saved record when editing.
  useEffect(() => {
    if (!open || !modality) return;
    setError(null);
    setDate(current ? current.date : todayISO());
    setData(current ? editableData(getForm(modality, "evaluation"), current.data) : {});
  }, [open, modality, current?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const save = useMutation({
    mutationFn: async () => {
      if (!modality) return;
      const r = await saveEvaluation(supabase, { clientId, modality, evaluationId: current?.id ?? null, date, data });
      if (r.error) throw new Error(r.error);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["evaluations", clientId] });
      onClose();
    },
    onError: (e) => setError(e.message),
  });

  return (
    <Sheet open={open} onClose={onClose} title={title}>
      {open && modality && (
        <>
          <DateField label="Data" value={date} onChange={(d) => setDate(d || todayISO())} />
          <FormFields def={getForm(modality, "evaluation")} value={data} onChange={setData} />
          {error && <Banner>{error}</Banner>}
          <View style={{ flexDirection: "row", gap: 8, justifyContent: "flex-end" }}>
            {onDelete && <Button kind="quiet" label="Excluir" onPress={onDelete} />}
            <Button kind="secondary" label="Cancelar" onPress={onClose} />
            <Button label={save.isPending ? "Salvando…" : "Salvar"} disabled={save.isPending} onPress={() => { setError(null); save.mutate(); }} />
          </View>
        </>
      )}
    </Sheet>
  );
}
