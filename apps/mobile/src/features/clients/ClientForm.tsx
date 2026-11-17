import type { ClientInput, EnrollmentInput } from "@fluxo/api";
import { MARITAL_OPTIONS, SEX_OPTIONS } from "@fluxo/copy";
import { maskPhone } from "@fluxo/domain";
import { useState } from "react";
import { Pressable, Switch, View } from "react-native";
import { Banner } from "@/ui/Banner";
import { Button } from "@/ui/Button";
import { Card } from "@/ui/Card";
import { ChoiceRow } from "@/ui/ChoiceRow";
import { DateField } from "@/ui/DateField";
import { ModalityTag } from "@/ui/ModalityTag";
import { Text } from "@/ui/Text";
import { TextField } from "@/ui/TextField";
import { useTheme } from "@/ui/theme";
import type { ModalityKey } from "@fluxo/forms";

/** The form's values. Empty means empty string here; `toInput` turns them into the nulls the API expects. */
export type ClientValues = { document: string; name: string; email: string; phone: string; emergency_contact_name: string; emergency_contact_phone: string; date_of_birth: string; sex: string; marital_status: string; city: string; profession: string; workplace: string; children: string; parents: string };

export const EMPTY_CLIENT: ClientValues = { document: "", name: "", email: "", phone: "", emergency_contact_name: "", emergency_contact_phone: "", date_of_birth: "", sex: "", marital_status: "", city: "", profession: "", workplace: "", children: "", parents: "" };

/** A modality the client can be enrolled in, with the people who teach it (for the responsible instructor). */
export type ModalityChoice = { id: string; key: ModalityKey; name: string; instructors: { id: string; name: string }[] };

/** modalityId -> responsible instructor id ("" = enrolled, nobody assigned). A missing id = not enrolled. */
export type Picked = Record<string, string>;

const orNull = (v: string) => (v.trim() === "" ? null : v.trim());

export function toInput(v: ClientValues): ClientInput {
  return {
    document: v.document.trim(), name: v.name.trim(), email: orNull(v.email), phone: orNull(v.phone), emergency_contact_name: orNull(v.emergency_contact_name),
    emergency_contact_phone: orNull(v.emergency_contact_phone), date_of_birth: orNull(v.date_of_birth), sex: orNull(v.sex) as ClientInput["sex"],
    marital_status: orNull(v.marital_status) as ClientInput["marital_status"], city: orNull(v.city), profession: orNull(v.profession), workplace: orNull(v.workplace),
    children: orNull(v.children), parents: orNull(v.parents),
  };
}

export const toEnrollments = (picked: Picked): EnrollmentInput[] => Object.entries(picked).map(([modalityId, instructorId]) => ({ modalityId, instructorId: instructorId === "" ? null : instructorId }));

/**
 * Dados pessoais, shared by "Novo cliente" and the Dados tab. `onSubmit` returns an error message or nothing.
 * Saving is a real submit: the button shows a pending state, nothing else waits.
 */
export function ClientForm({ initial, picked: initialPicked, modalities, canEditModalities, canReassign, submitLabel, onSubmit, children }: {
  initial: ClientValues;
  picked: Picked;
  /** The modalities this person may enroll the client in. */
  modalities: ModalityChoice[];
  /** False for an instructor editing a client: they see the modalities but cannot change them. */
  canEditModalities: boolean;
  /** Only admins choose who is responsible; an instructor enrolling a client is the responsible one. */
  canReassign: boolean;
  submitLabel: string;
  onSubmit: (values: ClientValues, picked: Picked) => Promise<string | void>;
  /** Extra sections saved together with the form (the history lists). */
  children?: React.ReactNode;
}) {
  const theme = useTheme();
  const [v, setV] = useState(initial);
  const [picked, setPicked] = useState<Picked>(() => (Object.keys(initialPicked).length === 0 && modalities.length === 1 ? { [modalities[0].id]: "" } : initialPicked));
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const set = (k: keyof ClientValues) => (t: string) => setV((s) => ({ ...s, [k]: t }));

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      const err = await onSubmit(v, picked);
      if (err) setError(err);
    } finally {
      setBusy(false);
    }
  }

  const toggle = (id: string) =>
    setPicked((p) => {
      const next = { ...p };
      if (id in next) delete next[id];
      else next[id] = "";
      return next;
    });

  return (
    <View style={{ gap: 16 }}>
      <Card style={{ gap: 14 }}>
        <Text variant="h2">Dados pessoais</Text>
        <TextField label="Documento" value={v.document} onChangeText={set("document")} placeholder="000.000.000-00" autoCapitalize="none" />
        <TextField label="Nome" value={v.name} onChangeText={set("name")} placeholder="Nome completo" autoCapitalize="words" />
        <TextField label="E-mail" value={v.email} onChangeText={set("email")} keyboardType="email-address" autoCapitalize="none" placeholder="nome@exemplo.com" />
        <TextField label="Telefone" value={maskPhone(v.phone)} onChangeText={(t) => set("phone")(maskPhone(t))} keyboardType="phone-pad" maxLength={15} />
        <DateField label="Data de nascimento" optional value={v.date_of_birth} onChange={set("date_of_birth")} />
        <View style={{ gap: 6 }}>
          <Text variant="small" color="ink2" style={{ fontWeight: "600" }}>Sexo</Text>
          <ChoiceRow value={v.sex} onChange={(x) => set("sex")(v.sex === x ? "" : x)} items={SEX_OPTIONS.map((o) => ({ value: o.value, label: o.label }))} />
        </View>
        <View style={{ gap: 6 }}>
          <Text variant="small" color="ink2" style={{ fontWeight: "600" }}>Estado civil</Text>
          <ChoiceRow value={v.marital_status} onChange={(x) => set("marital_status")(v.marital_status === x ? "" : x)} items={MARITAL_OPTIONS.map((o) => ({ value: o.value, label: o.label }))} />
        </View>
        <TextField label="Cidade" value={v.city} onChangeText={set("city")} maxLength={120} />
        <TextField label="Profissão" value={v.profession} onChangeText={set("profession")} maxLength={120} />
        <TextField label="Local de trabalho" value={v.workplace} onChangeText={set("workplace")} maxLength={120} />
        <TextField label="Filhos" value={v.children} onChangeText={set("children")} maxLength={300} placeholder="Ex.: 2 (Ana, 7; Pedro, 4)" />
        <TextField label="Pais" value={v.parents} onChangeText={set("parents")} maxLength={300} />
      </Card>

      <Card style={{ gap: 12 }}>
        <Text variant="h3">Modalidades e instrutor responsável</Text>
        {canEditModalities ? (
          <>
            {modalities.map((m) => {
              const on = m.id in picked;
              return (
                <View key={m.id} style={{ gap: 10, padding: 12, borderRadius: 12, borderWidth: 1, borderColor: on ? theme.accent : theme.line }}>
                  <Pressable accessibilityRole="checkbox" accessibilityState={{ checked: on }} onPress={() => toggle(m.id)} style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                    <Text variant="h3">{m.name}</Text>
                    <Switch value={on} onValueChange={() => toggle(m.id)} trackColor={{ true: theme.accent }} />
                  </Pressable>
                  {on && canReassign && (
                    <View style={{ gap: 6 }}>
                      <Text variant="small" color="ink2" style={{ fontWeight: "600" }}>Instrutor responsável</Text>
                      <ChoiceRow value={picked[m.id]} onChange={(id) => setPicked((p) => ({ ...p, [m.id]: p[m.id] === id ? "" : id }))} items={[{ value: "", label: "Sem instrutor" }, ...m.instructors.map((i) => ({ value: i.id, label: i.name }))]} />
                    </View>
                  )}
                  {on && !canReassign && <Text variant="small" color="ink2">Você será o responsável.</Text>}
                </View>
              );
            })}
            {modalities.length === 0 && <Text variant="small" color="ink2">Você ainda não ensina nenhuma modalidade. Peça a um administrador para configurar.</Text>}
            <Text variant="small" color="ink3">Escolha as modalidades do cliente{canReassign ? " e quem é o responsável em cada uma" : ""}. Cada instrutor vê o cliente só nas modalidades em que é responsável.</Text>
          </>
        ) : (
          <View style={{ gap: 8 }}>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>{modalities.filter((m) => m.id in initialPicked).map((m) => <ModalityTag key={m.id} modality={m.key} />)}</View>
            <Text variant="small" color="ink2">Apenas administradores alteram as modalidades.</Text>
          </View>
        )}
      </Card>

      <Card style={{ gap: 14 }}>
        <Text variant="h3">Contato de emergência</Text>
        <TextField label="Nome" value={v.emergency_contact_name} onChangeText={set("emergency_contact_name")} autoCapitalize="words" />
        <TextField label="Telefone" value={maskPhone(v.emergency_contact_phone)} onChangeText={(t) => set("emergency_contact_phone")(maskPhone(t))} keyboardType="phone-pad" maxLength={15} />
      </Card>

      {children}

      {error && <Banner>{error}</Banner>}
      <Button label={busy ? "Salvando…" : submitLabel} disabled={busy} onPress={submit} />
    </View>
  );
}
