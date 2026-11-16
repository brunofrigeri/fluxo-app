import { listUsers, updateUser, type UserItem } from "@fluxo/api";
import { roleLabels } from "@fluxo/copy";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Redirect } from "expo-router";
import { useEffect, useState } from "react";
import { Alert, Pressable, View } from "react-native";
import { useMe } from "@/lib/me";
import { supabase } from "@/lib/supabase";
import { useToast } from "@/lib/toast";
import { callWeb } from "@/lib/webApi";
import { Avatar } from "@/ui/Avatar";
import { Banner } from "@/ui/Banner";
import { Button } from "@/ui/Button";
import { Card } from "@/ui/Card";
import { ChoiceRow } from "@/ui/ChoiceRow";
import { Empty } from "@/ui/Empty";
import { Icon } from "@/ui/Icon";
import { ModalityTag } from "@/ui/ModalityTag";
import { Pill } from "@/ui/Pill";
import { Screen } from "@/ui/Screen";
import { Sheet } from "@/ui/Sheet";
import { Text } from "@/ui/Text";
import { TextField } from "@/ui/TextField";
import { ToggleChip } from "@/ui/ToggleChip";
import { useTheme } from "@/ui/theme";

type Role = "admin" | "instructor";

export default function Users() {
  const { me, isAdmin, studioModalities } = useMe();
  const theme = useTheme();
  const qc = useQueryClient();
  const toast = useToast();
  const [sheet, setSheet] = useState<{ user: UserItem | null } | null>(null);

  const q = useQuery({ queryKey: ["users"], enabled: isAdmin, queryFn: () => listUsers(supabase) });

  // Removal is optimistic: the row leaves at once and comes back with a message if the server refuses.
  const remove = useMutation({
    mutationFn: async (id: string) => {
      const r = await callWeb(`/api/users/${id}`, { method: "DELETE" });
      if (r.error) throw new Error(r.error);
    },
    onMutate: async (id) => {
      await qc.cancelQueries({ queryKey: ["users"] });
      const previous = qc.getQueryData<UserItem[]>(["users"]);
      qc.setQueryData<UserItem[]>(["users"], (d) => d?.filter((u) => u.id !== id));
      return { previous };
    },
    onError: (e, _id, ctx) => {
      qc.setQueryData(["users"], ctx?.previous);
      toast(e.message);
    },
    onSettled: () => {
      for (const k of ["users", "instructors-by-modality", "clients", "agenda"]) qc.invalidateQueries({ queryKey: [k] });
    },
  });

  const confirmRemove = (u: UserItem) =>
    Alert.alert(`Remover ${u.name}?`, "A conta e o acesso ao Fluxo são excluídos; os clientes dessa pessoa ficam sem instrutor atribuído.", [
      { text: "Cancelar", style: "cancel" },
      { text: "Remover", style: "destructive", onPress: () => remove.mutate(u.id) },
    ]);

  if (!isAdmin) return <Redirect href="/" />;

  return (
    <Screen back title="Usuários" right={<Button label="Convidar" onPress={() => setSheet({ user: null })} />} refreshing={q.isRefetching} onRefresh={() => q.refetch()}>
      {q.isError && <Banner>{(q.error as Error).message}</Banner>}
      {q.isPending && <Text color="ink2">Carregando…</Text>}
      {q.data && q.data.length === 0 && <Empty title="Nenhum usuário ainda" />}

      {q.data?.map((u) => (
        <Card key={u.id} style={{ gap: 10 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
            <Avatar name={u.name} size={40} />
            <View style={{ flex: 1, gap: 2 }}>
              <Text variant="h3">{u.name}{u.id === me.id ? <Text variant="small" color="ink2"> (você)</Text> : null}</Text>
              <Text variant="small" color="ink2">{u.email}</Text>
            </View>
            <Pressable accessibilityRole="button" accessibilityLabel={`Editar ${u.name}`} onPress={() => setSheet({ user: u })} hitSlop={10}><Icon name="edit" size={20} color={theme.ink2} /></Pressable>
            {u.id !== me.id && <Pressable accessibilityRole="button" accessibilityLabel={`Remover ${u.name}`} onPress={() => confirmRemove(u)} hitSlop={10}><Icon name="x" size={20} color={theme.ink2} /></Pressable>}
          </View>
          <View style={{ flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 8 }}>
            <Pill accent={u.role === "admin"} label={roleLabels[u.role]} />
            {studioModalities.filter((m) => u.modalityIds.includes(m.id)).map((m) => <ModalityTag key={m.id} modality={m.key} />)}
            {u.workingHours && <Text variant="small" color="ink2">{u.workingHours}</Text>}
          </View>
        </Card>
      ))}

      <UserSheet user={sheet?.user ?? null} open={!!sheet} onClose={() => setSheet(null)} />
    </Screen>
  );
}

function UserSheet({ user, open, onClose }: { user: UserItem | null; open: boolean; onClose: () => void }) {
  const { studioModalities } = useMe();
  const qc = useQueryClient();
  const mode = user ? "edit" : "invite";
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<Role>("instructor");
  const [hours, setHours] = useState("");
  const [picked, setPicked] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setError(null);
    setName(user?.name ?? "");
    setEmail(user?.email ?? "");
    setRole(user?.role ?? "instructor");
    setHours(user?.workingHours ?? "");
    setPicked(user?.modalityIds ?? []);
  }, [open, user]);

  // Admins are instructors by default: choosing Administrador ticks every modality when inviting (still editable).
  function chooseRole(next: Role) {
    setRole(next);
    if (next === "admin" && mode === "invite") setPicked(studioModalities.map((m) => m.id));
  }

  const save = useMutation({
    mutationFn: async () => {
      const r = user
        ? await updateUser(supabase, { role: "admin" }, user.id, { name, role, workingHours: hours.trim() || null, modalityIds: picked })
        : await callWeb("/api/users/invite", { method: "POST", body: { name, email, role, workingHours: hours.trim() || null, modalityIds: picked } });
      if (r.error) throw new Error(r.error);
    },
    onSuccess: () => {
      for (const k of ["users", "instructors-by-modality", "agenda", "clients"]) qc.invalidateQueries({ queryKey: [k] });
      onClose();
    },
    onError: (e) => setError(e.message),
  });

  return (
    <Sheet open={open} onClose={onClose} title={mode === "invite" ? "Convidar usuário" : "Editar usuário"}>
      <TextField label="Nome" value={name} onChangeText={setName} autoCapitalize="words" />
      {mode === "invite" ? (
        <TextField label="E-mail" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" />
      ) : (
        <TextField label="E-mail" value={email} editable={false} />
      )}
      <View style={{ gap: 6 }}>
        <Text variant="small" color="ink2" style={{ fontWeight: "600" }}>Papel</Text>
        <ChoiceRow value={role} onChange={chooseRole} items={[{ value: "instructor", label: "Instrutor" }, { value: "admin", label: "Administrador" }]} />
      </View>
      <View style={{ gap: 8 }}>
        <Text variant="small" color="ink2" style={{ fontWeight: "600" }}>Modalidades que ensina</Text>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
          {studioModalities.map((m) => (
            <ToggleChip key={m.id} label={m.name} on={picked.includes(m.id)} onPress={() => setPicked((p) => (p.includes(m.id) ? p.filter((x) => x !== m.id) : [...p, m.id]))} />
          ))}
        </View>
        <Text variant="small" color="ink3">Administradores também são instrutores: ensinam todas as modalidades do estúdio, a não ser que você desmarque. Um instrutor só pode ser responsável por clientes nas modalidades que ensina.</Text>
      </View>
      <TextField label="Horário de trabalho" value={hours} onChangeText={setHours} placeholder="Ex.: Seg–Sex, 7h–19h" help="Apenas informativo, não afeta a agenda." />
      {error && <Banner>{error}</Banner>}
      <Button label={save.isPending ? (mode === "invite" ? "Convidando…" : "Salvando…") : mode === "invite" ? "Enviar convite" : "Salvar"} disabled={save.isPending} onPress={() => { setError(null); save.mutate(); }} />
    </Sheet>
  );
}
