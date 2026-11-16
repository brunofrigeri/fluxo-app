import {
  APPARATUS_KEYS, APPARATUS_LABELS, EXERCISE_LABELS, REGION_LABELS, TONGUE_ZONE_LABELS, countFields, displayValue, leaves, readSections,
  type FormDefinition, type RecordData, type Row, type TongueZoneKey,
} from "@fluxo/forms";
import { View } from "react-native";
import { Card } from "@/ui/Card";
import { Pill } from "@/ui/Pill";
import { Text } from "@/ui/Text";
import { useTheme } from "@/ui/theme";

/** Read-only view of a saved record: only the filled fields, section by section. */
export function FormReadView({ def, data }: { def: FormDefinition; data: RecordData }) {
  const sections = readSections(def, data);
  if (sections.length === 0) return <Text color="ink2" style={{ paddingVertical: 20 }}>Nenhum campo preenchido.</Text>;

  return (
    <View style={{ gap: 16 }}>
      {sections.map((section) => {
        const apparatus = section.items.find((i) => i.field.kind === "custom" && i.field.custom === "pilates-apparatus");
        if (apparatus) return <ApparatusRead key={section.id} value={apparatus.value} />;
        return (
          <Card key={section.id} style={{ gap: 14 }}>
            <Text variant="h2">{section.title}</Text>
            {section.items.map(({ field, value }, i) => (
              <View key={field.key} style={{ gap: 4 }}>
                {field.group && field.group !== section.items[i - 1]?.field.group && <Text variant="tiny" color="ink3">{field.group}</Text>}
                <Text variant="small" color="ink2">{field.label}</Text>
                <Value field={field} value={value} />
              </View>
            ))}
          </Card>
        );
      })}
    </View>
  );
}

function Value({ field, value }: { field: FormDefinition["sections"][number]["fields"][number]; value: unknown }) {
  if (field.kind === "rows") {
    return (
      <View style={{ gap: 6 }}>
        {(value as Row[]).map((r, i) => (
          <Text key={i}>{r.label ? <Text style={{ fontWeight: "700" }}>{r.label}: </Text> : null}{r.value}</Text>
        ))}
      </View>
    );
  }
  if (field.kind === "custom" && field.custom === "tongue-zones") {
    return (
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
        {(value as TongueZoneKey[]).map((z) => <Pill key={z} label={TONGUE_ZONE_LABELS[z]} />)}
      </View>
    );
  }
  return <Text>{displayValue(field, value)}</Text>;
}

function ApparatusRead({ value }: { value: unknown }) {
  const theme = useTheme();
  const all = leaves(value);
  const total = countFields(value);
  const shown = APPARATUS_KEYS.filter((a) => all.some((l) => l.apparatus === a));
  return (
    <View style={{ gap: 12 }}>
      <Card style={{ gap: 0, paddingVertical: 4 }}>
        {shown.map((a, i) => (
          <View key={a} style={{ gap: 10, paddingVertical: 14, borderBottomWidth: i < shown.length - 1 ? 1 : 0, borderBottomColor: theme.line }}>
            <Text variant="h2">{APPARATUS_LABELS[a]}</Text>
            {all.filter((l) => l.apparatus === a).map((l) => (
              <View key={l.exercise} style={{ gap: 8 }}>
                <Pill accent label={EXERCISE_LABELS[l.exercise]} />
                {l.regions.length > 0 && (
                  <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                    {l.regions.map((r) => <Pill key={r} label={REGION_LABELS[r]} />)}
                  </View>
                )}
                {l.note ? <Text>{l.note}</Text> : null}
              </View>
            ))}
          </View>
        ))}
      </Card>
      <Text variant="small" color="ink2">Mostrando só os {total} {total === 1 ? "campo preenchido" : "campos preenchidos"}. Os demais aparelhos não foram usados nesta sessão.</Text>
    </View>
  );
}
