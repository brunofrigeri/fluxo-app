import { TONGUE_ZONE_KEYS, TONGUE_ZONE_LABELS, normalizeTree, type Field, type FormDefinition, type RecordData, type Row, type Section } from "@fluxo/forms";
import { Fragment, useState } from "react";
import { Pressable, View } from "react-native";
import { Button } from "@/ui/Button";
import { Card } from "@/ui/Card";
import { ChoiceRow } from "@/ui/ChoiceRow";
import { DateField } from "@/ui/DateField";
import { Icon } from "@/ui/Icon";
import { Text } from "@/ui/Text";
import { TextField } from "@/ui/TextField";
import { ToggleChip } from "@/ui/ToggleChip";
import { useTheme } from "@/ui/theme";
import { ApparatusField } from "./ApparatusField";

/** The one native renderer for every form definition: sections, fields, groups. Adding a modality adds no screens. */
export function FormFields({ def, value, onChange }: { def: FormDefinition; value: RecordData; onChange: (next: RecordData) => void }) {
  const set = (key: string, v: unknown) => onChange({ ...value, [key]: v });
  // A form that is a single custom widget (the Pilates apparatus tree) is drawn without a card around it.
  const bare = (s: Section) => s.fields.length === 1 && s.fields[0].kind === "custom" && s.fields[0].custom === "pilates-apparatus";

  return (
    <View style={{ gap: 16 }}>
      {def.sections.map((section) =>
        bare(section) ? (
          <ApparatusField key={section.id} value={normalizeTree(value[section.fields[0].key], { trim: false })} onChange={(tree) => set(section.fields[0].key, tree)} />
        ) : (
          <Card key={section.id} style={{ gap: 16 }}>
            <View style={{ gap: 2 }}>
              <Text variant="h2" accessibilityRole="header">{section.title}</Text>
              {section.description && <Text variant="small" color="ink2">{section.description}</Text>}
            </View>
            {section.fields.map((f, i) => (
              <Fragment key={f.key}>
                {f.group && f.group !== section.fields[i - 1]?.group && <Text variant="tiny" color="ink3" style={{ marginTop: 4 }}>{f.group}</Text>}
                <FieldInput f={f} value={value[f.key]} onChange={(v) => set(f.key, v)} />
              </Fragment>
            ))}
          </Card>
        ),
      )}
    </View>
  );
}

function Label({ f }: { f: Field }) {
  return (
    <View style={{ gap: 2 }}>
      <Text variant="small" color="ink2" style={{ fontWeight: "600" }}>{f.label}</Text>
      {f.help && <Text variant="small" color="ink3">{f.help}</Text>}
    </View>
  );
}

function FieldInput({ f, value, onChange }: { f: Field; value: unknown; onChange: (v: unknown) => void }) {
  switch (f.kind) {
    case "text":
      return <TextField label={f.label} help={f.help} value={typeof value === "string" ? value : ""} maxLength={f.maxLength ?? 500} placeholder={f.placeholder} onChangeText={onChange} />;
    case "textarea":
      return <TextField label={f.label} help={f.help} multiline value={typeof value === "string" ? value : ""} maxLength={f.maxLength ?? 5000} placeholder={f.placeholder} onChangeText={onChange} />;
    case "number":
      return <NumberInput f={f} value={value} onChange={onChange} />;
    case "date":
      return <DateField label={f.label} optional value={typeof value === "string" ? value : ""} onChange={(v) => onChange(v === "" ? undefined : v)} />;
    case "choice":
      return (
        <View style={{ gap: 8 }}>
          <Label f={f} />
          {/* tapping the selected option clears it, like the web */}
          <ChoiceRow value={typeof value === "string" ? value : ""} onChange={(v) => onChange(value === v ? undefined : v)} items={f.options.map((o) => ({ value: o.value, label: o.label }))} />
        </View>
      );
    case "multichoice": {
      const picked = Array.isArray(value) ? (value as string[]) : [];
      return (
        <View style={{ gap: 8 }}>
          <Label f={f} />
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
            {f.options.map((o) => (
              <ToggleChip key={o.value} label={o.label} on={picked.includes(o.value)} onPress={() => onChange(picked.includes(o.value) ? picked.filter((x) => x !== o.value) : [...picked, o.value])} />
            ))}
          </View>
        </View>
      );
    }
    case "boolean":
      return (
        <View style={{ gap: 8 }}>
          <Label f={f} />
          <ChoiceRow
            value={value === true ? "yes" : value === false ? "no" : ""}
            onChange={(v) => onChange((v === "yes") === (value === true) && value !== undefined ? undefined : v === "yes")}
            items={[{ value: "yes", label: "Sim" }, { value: "no", label: "Não" }]}
          />
        </View>
      );
    case "rows":
      return <RowsInput f={f} value={value} onChange={onChange} />;
    case "custom": {
      if (f.custom !== "tongue-zones") return null; // pilates-apparatus is drawn by FormFields as a whole section
      const picked = Array.isArray(value) ? (value as string[]) : [];
      return (
        <View style={{ gap: 8 }}>
          <Label f={f} />
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
            {TONGUE_ZONE_KEYS.map((z) => (
              <ToggleChip key={z} label={TONGUE_ZONE_LABELS[z]} on={picked.includes(z)} onPress={() => onChange(picked.includes(z) ? picked.filter((x) => x !== z) : [...picked, z])} />
            ))}
          </View>
        </View>
      );
    }
  }
}

/** Keeps what is being typed ("1." or "") separate from the parsed number so decimals can be entered. */
function NumberInput({ f, value, onChange }: { f: Extract<Field, { kind: "number" }>; value: unknown; onChange: (v: unknown) => void }) {
  const [text, setText] = useState(typeof value === "number" ? String(value) : "");
  return (
    <TextField
      label={f.label}
      help={f.help}
      keyboardType="decimal-pad"
      value={text}
      onChangeText={(t) => {
        setText(t);
        const n = Number(t.replace(",", "."));
        onChange(t.trim() === "" || !Number.isFinite(n) ? undefined : n);
      }}
    />
  );
}

/** Repeating (label, value) rows. Suggested labels start as empty rows; rows without a value are dropped on save. */
function RowsInput({ f, value, onChange }: { f: Extract<Field, { kind: "rows" }>; value: unknown; onChange: (v: unknown) => void }) {
  const theme = useTheme();
  const stored: Row[] = Array.isArray(value) ? (value as Row[]) : [];
  const missing = (f.suggestedLabels ?? []).filter((l) => !stored.some((r) => r.label === l)).map((label) => ({ label, value: "" }));
  const rows = [...stored, ...missing];
  const max = f.maxRows ?? 50;
  const replace = (i: number, patch: Partial<Row>) => onChange(rows.map((r, j) => (j === i ? { ...r, ...patch } : r)));

  return (
    <View style={{ gap: 8 }}>
      <Label f={f} />
      {rows.map((r, i) => (
        <View key={i} style={{ gap: 6, padding: 12, borderRadius: 12, backgroundColor: theme.stone }}>
          <View style={{ flexDirection: "row", alignItems: "flex-end", gap: 8 }}>
            <View style={{ flex: 1 }}>
              <TextField label={`${f.label}, nome ${i + 1}`} value={r.label} maxLength={120} placeholder={f.labelPlaceholder ?? "Nome"} onChangeText={(v) => replace(i, { label: v })} />
            </View>
            <Pressable accessibilityRole="button" accessibilityLabel="Remover linha" onPress={() => onChange(rows.filter((_, j) => j !== i))} hitSlop={8} style={{ height: 46, justifyContent: "center" }}>
              <Icon name="x" size={20} color={theme.ink2} />
            </Pressable>
          </View>
          <TextField label={`${f.label}, texto ${i + 1}`} multiline value={r.value} maxLength={5000} placeholder={f.valuePlaceholder ?? "Anotação"} onChangeText={(v) => replace(i, { value: v })} />
        </View>
      ))}
      {rows.length < max && <Button kind="secondary" label={f.addLabel ?? "Adicionar"} onPress={() => onChange([...rows, { label: "", value: "" }])} />}
    </View>
  );
}
