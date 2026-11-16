import { getSessionNote, saveSessionNote } from "@fluxo/api";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { View } from "react-native";
import { useMe } from "@/lib/me";
import { supabase } from "@/lib/supabase";
import { Banner } from "@/ui/Banner";
import { Button } from "@/ui/Button";
import { Text } from "@/ui/Text";
import { TextField } from "@/ui/TextField";

/** The shared note of a class slot (date + hour + modality). Reading is cached; saving is a real submit. */
export function NoteBlock({ date, hour, modalityId, title }: { date: string; hour: number; modalityId: string; title: string }) {
  const { me } = useMe();
  const qc = useQueryClient();
  const key = ["note", date, hour, modalityId];
  const q = useQuery({ queryKey: key, queryFn: async () => (await getSessionNote(supabase, date, hour, modalityId)) ?? "" });
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const [error, setError] = useState<string | null>(null);

  const save = useMutation({
    mutationFn: async () => {
      const r = await saveSessionNote(supabase, me.studioId, date, hour, modalityId, draft);
      if (r.error) throw new Error(r.error);
    },
    onSuccess: () => {
      qc.setQueryData(key, draft.trim());
      setEditing(false);
    },
    onError: (e) => setError(e.message),
  });

  const note = q.data;
  return (
    <View style={{ gap: 8 }}>
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
        <Text variant="small" color="ink2" style={{ fontWeight: "600" }}>{title}</Text>
        {!editing && note !== undefined && <Button kind="quiet" label={note ? "Editar" : "Adicionar"} onPress={() => { setDraft(note); setError(null); setEditing(true); }} />}
      </View>
      {note === undefined ? (
        <Text variant="small" color="ink3">Carregando…</Text>
      ) : editing ? (
        <>
          <TextField label="Nota" multiline maxLength={2000} value={draft} onChangeText={setDraft} placeholder="Ex.: turma cheia, trocar colchonete, aquecer antes do reformer…" />
          {error && <Banner>{error}</Banner>}
          <View style={{ flexDirection: "row", gap: 8, justifyContent: "flex-end" }}>
            <Button kind="secondary" label="Cancelar" onPress={() => setEditing(false)} />
            <Button label={save.isPending ? "Salvando…" : "Salvar"} disabled={save.isPending} onPress={() => save.mutate()} />
          </View>
        </>
      ) : note ? (
        <Text>{note}</Text>
      ) : (
        <Text variant="small" color="ink2">Sem notas ainda.</Text>
      )}
    </View>
  );
}
