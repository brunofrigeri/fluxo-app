import { deleteDocument, formatSize, getClientPayments, getDocumentUrl, uploadReceipt, type Receipt } from "@fluxo/api";
import { paymentCopy } from "@fluxo/copy";
import { formatBR, formatShort } from "@fluxo/domain";
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
import { Empty } from "@/ui/Empty";
import { Icon } from "@/ui/Icon";
import { Pill } from "@/ui/Pill";
import { Text } from "@/ui/Text";
import { TextField } from "@/ui/TextField";
import { useTheme } from "@/ui/theme";
import { PaymentActions } from "./PaymentActions";

/** The "Pagamentos" tab of a client (admins): each due date with its status, and the receipts attached to each payment. */
export function ClientPaymentsTab({ clientId }: { clientId: string }) {
  const q = useQuery({ queryKey: ["client-payments", clientId], queryFn: () => getClientPayments(supabase, clientId) });
  if (q.isPending) return <Text color="ink2">Carregando…</Text>;
  if (q.isError) return <Banner>{(q.error as Error).message}</Banner>;
  const { billingDay, payments } = q.data;

  if (billingDay === null) return <Card><Empty title="Sem dia de pagamento">{`Defina o ${paymentCopy.billingDay.toLowerCase()} na aba Dados para acompanhar os vencimentos deste cliente.`}</Empty></Card>;
  return (
    <View style={{ gap: 12 }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
        <Text variant="h2" style={{ flex: 1 }}>{paymentCopy.title}</Text>
        <Pill label={`Vence todo dia ${billingDay}`} />
      </View>
      {payments.length === 0 && <Text color="ink2">O primeiro vencimento ainda não chegou.</Text>}
      {payments.map((p) => (
        <Card key={p.dueDate} style={{ gap: 12 }}>
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
            <View style={{ flexShrink: 1 }}>
              <Text variant="h3">{formatShort(p.dueDate)}</Text>
              {p.status === "paid" && p.paidOn && <Text variant="small" color="ink2">{paymentCopy.paidOn} {formatBR(p.paidOn)}</Text>}
            </View>
            <PaymentActions clientId={clientId} dueDate={p.dueDate} status={p.status} overdue={p.overdue} />
          </View>
          {p.receipts.map((r) => <ReceiptRow key={r.id} clientId={clientId} receipt={r} />)}
          {p.paymentId ? <ReceiptAdd clientId={clientId} paymentId={p.paymentId} /> : <Text variant="small" color="ink3">Registre o pagamento para anexar um comprovante.</Text>}
        </Card>
      ))}
    </View>
  );
}

function ReceiptRow({ clientId, receipt }: { clientId: string; receipt: Receipt }) {
  const theme = useTheme();
  const qc = useQueryClient();
  const toast = useToast();

  const remove = useMutation({
    mutationFn: async () => {
      const r = await deleteDocument(supabase, clientId, receipt.id);
      if (r.error) throw new Error(r.error);
    },
    onError: (e) => toast(e.message),
    onSettled: () => qc.invalidateQueries({ queryKey: ["client-payments", clientId] }),
  });

  async function open() {
    const { url, error } = await getDocumentUrl(supabase, clientId, receipt.id);
    if (!url) return toast(error ?? "Não foi possível abrir o comprovante.");
    await WebBrowser.openBrowserAsync(url);
  }

  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
      <Icon name="note" size={16} color={theme.ink3} />
      <Pressable accessibilityRole="link" onPress={open} style={{ flex: 1, gap: 2 }}>
        <Text variant="h3">{receipt.name}</Text>
        <Text variant="small" color="ink2">{formatSize(receipt.sizeBytes)} · {formatBR(receipt.createdAt)}</Text>
      </Pressable>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Remover ${receipt.name}`}
        hitSlop={10}
        onPress={() => Alert.alert("Remover comprovante?", `"${receipt.name}" será removido. Isso não pode ser desfeito.`, [{ text: "Cancelar", style: "cancel" }, { text: "Remover", style: "destructive", onPress: () => remove.mutate() }])}
      >
        <Icon name="x" size={18} color={theme.ink2} />
      </Pressable>
    </View>
  );
}

function ReceiptAdd({ clientId, paymentId }: { clientId: string; paymentId: string }) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
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
      const body = await (await fetch(picked.uri)).arrayBuffer();
      const r = await uploadReceipt(supabase, { clientId, paymentId, body, fileName: picked.name, mimeType: picked.mimeType ?? "", sizeBytes: picked.size ?? body.byteLength, label });
      if (r.error) throw new Error(r.error);
    },
    onSuccess: () => {
      setOpen(false);
      setPicked(null);
      setLabel("");
      qc.invalidateQueries({ queryKey: ["client-payments", clientId] });
    },
    onError: (e) => setError(e.message),
  });

  if (!open) return <Button kind="secondary" label={paymentCopy.addReceipt} onPress={() => { setError(null); setOpen(true); }} />;
  return (
    <View style={{ gap: 10 }}>
      <Button kind="secondary" label={picked ? picked.name : "Escolher arquivo"} onPress={choose} />
      <TextField label="Nome (opcional)" value={label} onChangeText={setLabel} />
      <Text variant="small" color="ink3">PDF, JPG, PNG ou HEIC, até 10MB.</Text>
      {error && <Banner>{error}</Banner>}
      <View style={{ flexDirection: "row", gap: 8, justifyContent: "flex-end" }}>
        <Button kind="secondary" label="Cancelar" onPress={() => { setOpen(false); setPicked(null); }} />
        <Button label={upload.isPending ? "Enviando…" : "Enviar"} disabled={!picked || upload.isPending} onPress={() => { setError(null); upload.mutate(); }} />
      </View>
    </View>
  );
}

