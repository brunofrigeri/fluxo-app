import { statusLabels } from "@fluxo/copy";
import { STATUS_VALUES, type AttendanceStatus } from "@fluxo/domain";
import { useState } from "react";
import { Pressable, View } from "react-native";
import { Button } from "./Button";
import { StatusChip } from "./Chip";
import { Sheet } from "./Sheet";
import { Text } from "./Text";
import { TextField } from "./TextField";
import { useTheme } from "./theme";
import { statusColors } from "./status";

/**
 * The four attendance statuses of a booking. "Falta justificada" asks for the reason first.
 * A replacement is created by scheduling one (it points at the missed session), so it cannot be picked here,
 * and a booking that is a replacement keeps that status. Choosing calls `onSelect` and `onDone` at once: the caller
 * saves optimistically (see useSetStatus), nothing here waits on the network.
 */
export function StatusPicker({ status, missReason, onSelect, onDone }: {
  status: AttendanceStatus | null;
  missReason: string | null;
  onSelect: (status: AttendanceStatus | null, reason?: string) => void;
  onDone: () => void;
}) {
  const theme = useTheme();
  const [asking, setAsking] = useState(false);
  const [reason, setReason] = useState(missReason ?? "");
  const isReplacement = status === "REPLACEMENT";

  function pick(value: AttendanceStatus) {
    if (value === "JUSTIFIED_MISS") return setAsking(true); // also when already selected: edit the reason
    if (value !== status) onSelect(value);
    onDone();
  }

  const reasonOk = reason.trim().length > 0;

  return (
    <View style={{ gap: 12 }}>
      <View style={{ gap: 8 }}>
        {STATUS_VALUES.map((value) => {
          const selected = status === value;
          const locked = value === "REPLACEMENT" ? !selected : isReplacement;
          const c = statusColors(theme, value);
          return (
            <Pressable
              key={value}
              accessibilityRole="button"
              accessibilityState={{ selected, disabled: locked }}
              disabled={locked}
              onPress={() => pick(value)}
              style={{ flexDirection: "row", alignItems: "center", gap: 10, minHeight: 48, paddingHorizontal: 14, borderRadius: 12, backgroundColor: c.bg, borderWidth: 2, borderColor: selected ? c.dot : "transparent", opacity: locked ? 0.45 : 1 }}
            >
              <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: c.dot }} />
              <Text variant="h3" style={{ color: c.fg }}>{statusLabels[value]}</Text>
            </Pressable>
          );
        })}
      </View>

      <Hint status={status} />

      {status === "JUSTIFIED_MISS" && missReason && !asking && (
        <Text variant="small" color="ink2"><Text variant="small" style={{ fontWeight: "700" }}>Motivo: </Text>{missReason}</Text>
      )}

      {asking && (
        <View style={{ gap: 10 }}>
          <TextField label="Motivo da falta" value={reason} onChangeText={setReason} maxLength={300} autoFocus placeholder="Ex.: gripe, viagem, compromisso de trabalho" />
          <View style={{ flexDirection: "row", gap: 8, justifyContent: "flex-end" }}>
            <Button kind="secondary" label="Cancelar" onPress={() => setAsking(false)} />
            <Button label="Confirmar" disabled={!reasonOk} onPress={() => { onSelect("JUSTIFIED_MISS", reason.trim()); onDone(); }} />
          </View>
        </View>
      )}

      {status && !isReplacement && !asking && <Button kind="quiet" label="Limpar status" onPress={() => { onSelect(null); onDone(); }} />}
    </View>
  );
}

/** The picker in a sheet. The sheet remounts its content on open, so the reason field always starts from the saved one. */
export function StatusSheet({ open, onClose, status, missReason, clientName, onSelect }: {
  open: boolean;
  onClose: () => void;
  status: AttendanceStatus | null;
  missReason: string | null;
  clientName?: string;
  onSelect: (status: AttendanceStatus | null, reason?: string) => void;
}) {
  return (
    <Sheet open={open} onClose={onClose} title={clientName ?? "Presença"}>
      {open && <StatusPicker status={status} missReason={missReason} onSelect={onSelect} onDone={onClose} />}
    </Sheet>
  );
}

function Hint({ status }: { status: AttendanceStatus | null }) {
  if (status === "REPLACEMENT") return <Text variant="small" color="ink2">Esta sessão é uma reposição e mantém o status.</Text>;
  return <Text variant="small" color="ink3">Para uma reposição, use “É reposição?” ao adicionar o cliente a um horário.</Text>;
}

/** The status chip as a button that opens the sheet. */
export function StatusButton({ status, onPress }: { status: AttendanceStatus | null; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="button" onPress={onPress} hitSlop={6}>
      <StatusChip status={status} />
    </Pressable>
  );
}
