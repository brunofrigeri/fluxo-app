import {
  APPARATUS_KEYS, APPARATUS_LABELS, EXERCISE_KEYS, EXERCISE_LABELS, REGION_KEYS, REGION_LABELS, countFields,
  type Apparatus, type ApparatusKey, type Exercise, type ExerciseKey, type RegionKey,
} from "@fluxo/forms";
import { useState } from "react";
import { Pressable, View } from "react-native";
import { ChoiceRow } from "@/ui/ChoiceRow";
import { Icon } from "@/ui/Icon";
import { Text } from "@/ui/Text";
import { TextField } from "@/ui/TextField";
import { ToggleChip } from "@/ui/ToggleChip";
import { useTheme } from "@/ui/theme";

const EMPTY: Exercise = { regions: [] };

/** The Pilates evolution tree: 5 apparatus x 3 exercise types, each with the regions worked and a note. */
export function ApparatusField({ value, onChange }: { value: Apparatus; onChange: (next: Apparatus) => void }) {
  const theme = useTheme();
  const [open, setOpen] = useState<ApparatusKey | null>(() => APPARATUS_KEYS.find((k) => countFields(value, k) > 0) ?? "reformer");
  const [exercise, setExercise] = useState<Record<ApparatusKey, ExerciseKey>>({ reformer: "strengthening", barrel: "strengthening", cadillac: "strengthening", chair: "strengthening", balance: "strengthening" });
  const filled = countFields(value);

  function update(a: ApparatusKey, e: ExerciseKey, patch: Partial<Exercise>) {
    onChange({ ...value, [a]: { ...value[a], [e]: { ...(value[a]?.[e] ?? EMPTY), ...patch } } });
  }
  function toggle(a: ApparatusKey, e: ExerciseKey, r: RegionKey) {
    const current = value[a]?.[e]?.regions ?? [];
    const next = current.includes(r) ? current.filter((x) => x !== r) : [...current, r];
    update(a, e, { regions: REGION_KEYS.filter((k) => next.includes(k)) });
  }

  return (
    <View style={{ gap: 12 }}>
      <View style={{ gap: 2 }}>
        <Text variant="h2">Aparelhos</Text>
        <Text variant="small" color="ink2">Todos os campos são opcionais. {filled} {filled === 1 ? "preenchido" : "preenchidos"}.</Text>
      </View>
      {APPARATUS_KEYS.map((a) => {
        const isOpen = open === a;
        const count = countFields(value, a);
        const current = exercise[a];
        const ex = value[a]?.[current] ?? EMPTY;
        return (
          <View key={a} style={{ borderRadius: 16, borderWidth: 1, borderColor: theme.line, backgroundColor: theme.surface, overflow: "hidden" }}>
            <Pressable accessibilityRole="button" accessibilityState={{ expanded: isOpen }} onPress={() => setOpen(isOpen ? null : a)} style={{ flexDirection: "row", alignItems: "center", gap: 10, minHeight: 52, paddingHorizontal: 14, backgroundColor: isOpen ? theme.stone : "transparent" }}>
              <Icon name={isOpen ? "chevd" : "chevr"} size={18} color={theme.ink2} />
              <Text variant="h3" style={{ flex: 1 }}>{APPARATUS_LABELS[a]}</Text>
              {count > 0 && <Text variant="small" color="accent" style={{ fontWeight: "700" }}>{count} {count === 1 ? "campo" : "campos"}</Text>}
            </Pressable>
            {isOpen && (
              <View style={{ padding: 14, gap: 14 }}>
                <ChoiceRow
                  value={current}
                  onChange={(e) => setExercise({ ...exercise, [a]: e })}
                  items={EXERCISE_KEYS.map((e) => ({ value: e, label: `${EXERCISE_LABELS[e]}${countFields({ [a]: { [e]: value[a]?.[e] } }) > 0 ? " •" : ""}` }))}
                />
                <View style={{ gap: 8 }}>
                  <Text variant="small" color="ink2" style={{ fontWeight: "600" }}>Regiões trabalhadas</Text>
                  <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                    {REGION_KEYS.map((r) => (
                      <ToggleChip key={r} label={REGION_LABELS[r]} on={ex.regions.includes(r)} onPress={() => toggle(a, current, r)} />
                    ))}
                  </View>
                </View>
                <TextField label="Detalhes (opcional)" multiline value={ex.note ?? ""} onChangeText={(v) => update(a, current, { note: v })} placeholder="Ex.: Footwork com 3 molas, 3 séries de 12" maxLength={5000} />
              </View>
            )}
          </View>
        );
      })}
    </View>
  );
}
