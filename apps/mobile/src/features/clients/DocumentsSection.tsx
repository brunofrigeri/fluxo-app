import { deleteDocument, formatSize, getDocumentUrl, listDocuments, uploadDocument, type DocumentItem } from "@fluxo/api";
import { formatBR } from "@fluxo/domain";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import * as DocumentPicker from "expo-document-picker";
import * as WebBrowser from "expo-web-browser";
import { useState } from "react";
import { Alert, Pressable, View } from "react-native";
import { supabase } from "@/lib/supabase";
import { useToast } from "@/lib/toast";
import { Banner } from "@/ui/Banner";
import { Button } from "@/ui/Button";
import { Card } from "@/ui/Card";
import { Icon } from "@/ui/Icon";
import { Text } from "@/ui/Text";
import { TextField } from "@/ui/TextField";
import { useTheme } from "@/ui/theme";

/** Documentos: upload (PDF, JPG, PNG, HEIC up to 10 MB), open through a short-lived signed URL, delete. */
export function DocumentsSection({ clientId }: { clientId: string }) {
  const theme = useTheme();
  const qc = useQueryClient();
  const toast = useToast();
  const key = ["documents", clientId];
  const q = useQuery({ queryKey: key, queryFn: () => listDocuments(supabase, clientId) });
  const [adding, setAdding] = useState(false);
  const [picked, setPicked] = useState<DocumentPicker.DocumentPickerAsset | null>(null);
  const [label, setLabel] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function choose() {
    const r = await DocumentPicker.getDocumentAsync({ type: ["application/pdf", "image/jpeg", "image/png", "image/heic", "image/heif"], copyToCacheDirectory: true });
    if (!r.canceled && r.assets[0]) setPicked(r.assets[0]);
  }

  const upload = useMutation({
    mutationFn: async () => {
      if (!picked) return;
      // the picked file is a local URI; reading it through fetch avoids a native file-system dependency
      const body = await (await fetch(picked.uri)).arrayBuffer();
      const r = await uploadDocument(supabase, { clientId, body, fileName: picked.name, mimeType: picked.mimeType ?? "", sizeBytes: picked.size ?? body.byteLength, label });
      if (r.error) throw new Error(r.error);
    },
    onSuccess: () => {
      setAdding(false);
      setPicked(null);
      setLabel("");
      qc.invalidateQueries({ queryKey: key });
    },
    onError: (e) => setError(e.message),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const r = await deleteDocument(supabase, clientId, id);
      if (r.error) throw new Error(r.error);
    },
    onMutate: async (id) => {
      await qc.cancelQueries({ queryKey: key });
      const previous = qc.getQueryData<DocumentItem[]>(key);
      qc.setQueryData<DocumentItem[]>(key, (d) => d?.filter((x) => x.id !== id));
      return { previous };
    },
    onError: (e, _id, ctx) => {
      qc.setQueryData(key, ctx?.previous);
      toast(e.message);
    },
    onSettled: () => qc.invalidateQueries({ queryKey: key }),
  });

  async function open(d: DocumentItem) {
    const { url, error: err } = await getDocumentUrl(supabase, clientId, d.id);
    if (!url) return toast(err ?? "Não foi possível abrir o documento.");
    await WebBrowser.openBrowserAsync(url);
  }

  const confirmRemove = (d: DocumentItem) =>
    Alert.alert("Remover documento?", `"${d.name}" será removido. Isso não pode ser desfeito.`, [
      { text: "Cancelar", style: "cancel" },
      { text: "Remover", style: "destructive", onPress: () => remove.mutate(d.id) },
    ]);

  const docs = q.data ?? [];
  return (
    <Card>
      <Text variant="h3">Documentos</Text>
      {q.isPending ? <Text variant="small" color="ink2">Carregando…</Text> : docs.length === 0 ? <Text variant="small" color="ink2">Nenhum documento ainda.</Text> : null}
      {docs.map((d) => (
        <View key={d.id} style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
          <Icon name="note" size={16} color={theme.ink3} />
          <Pressable accessibilityRole="link" onPress={() => open(d)} style={{ flex: 1, gap: 2 }}>
            <Text variant="h3">{d.name}</Text>
            <Text variant="small" color="ink2">{formatSize(d.sizeBytes)} · {formatBR(d.createdAt)}</Text>
          </Pressable>
          <Pressable accessibilityRole="button" accessibilityLabel={`Remover ${d.name}`} onPress={() => confirmRemove(d)} hitSlop={10}>
            <Icon name="x" size={18} color={theme.ink2} />
          </Pressable>
        </View>
      ))}
      {!adding ? (
        <Button kind="secondary" label="Adicionar documento" onPress={() => { setError(null); setAdding(true); }} />
      ) : (
        <View style={{ gap: 10 }}>
          <Button kind="secondary" label={picked ? picked.name : "Escolher arquivo"} onPress={choose} />
          <TextField label="Nome (opcional)" value={label} onChangeText={setLabel} />
          <Text variant="small" color="ink3">PDF, JPG, PNG ou HEIC, até 10MB.</Text>
          {error && <Banner>{error}</Banner>}
          <View style={{ flexDirection: "row", gap: 8, justifyContent: "flex-end" }}>
            <Button kind="secondary" label="Cancelar" onPress={() => { setAdding(false); setPicked(null); }} />
            <Button label={upload.isPending ? "Enviando…" : "Enviar"} disabled={!picked || upload.isPending} onPress={() => { setError(null); upload.mutate(); }} />
          </View>
        </View>
      )}
    </Card>
  );
}
