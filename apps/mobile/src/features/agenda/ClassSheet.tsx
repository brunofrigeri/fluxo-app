import type { AgendaBooking } from "@fluxo/api";
import { statusLabels, unmarkedLabel } from "@fluxo/copy";
import { formatWeekdayDate } from "@fluxo/domain";
import { MODALITY_LABELS, type ModalityKey } from "@fluxo/forms";
import { Pressable, View } from "react-native";
import { Avatar } from "@/ui/Avatar";
import { Card } from "@/ui/Card";
import { ModalityTag } from "@/ui/ModalityTag";
import { Sheet } from "@/ui/Sheet";
import { StatusChip } from "@/ui/Chip";
import { Text } from "@/ui/Text";
import { NoteBlock } from "./NoteBlock";

/** A class slot: who is in it, with the shared notes (one per modality present). Tapping a client opens them. */
export function ClassSheet({ bookings, onClose, onPick, isAdmin }: { bookings: AgendaBooking[]; onClose: () => void; onPick: (b: AgendaBooking) => void; isAdmin: boolean }) {
  const first = bookings[0];
  const open = bookings.length > 0;
  const instructors = [...new Set(bookings.map((b) => b.instructorName).filter((n): n is string => Boolean(n)))];
  // One class note per modality present in this slot (labelled one-off entries have none).
  const noted = [...new Map(bookings.filter((b) => b.modalityId && b.modalityKey).map((b) => [b.modalityId as string, b.modalityKey as ModalityKey])).entries()];

  return (
    <Sheet open={open} onClose={onClose} title={first ? formatWeekdayDate(first.date) : ""}>
      {first && (
        <>
          <Text color="ink2">
            {first.time} · {bookings.length === 1 ? "1 cliente" : `${bookings.length} clientes`}
            {isAdmin && instructors.length > 0 ? ` · ${instructors.length === 1 ? "Instrutor" : "Instrutores"}: ${instructors.join(", ")}` : ""}
          </Text>
          <View style={{ gap: 8 }}>
            {bookings.map((b) => (
              <Pressable key={b.id} accessibilityRole="button" accessibilityLabel={`${b.name}, ${b.status ? statusLabels[b.status] : unmarkedLabel}`} onPress={() => onPick(b)}>
                <Card flat style={{ flexDirection: "row", alignItems: "center", gap: 10, padding: 10 }}>
                  <Avatar name={b.name} size={32} />
                  <View style={{ flex: 1, gap: 2 }}>
                    <Text variant="h3">{b.name}</Text>
                    {isAdmin && b.modalityKey && <Text variant="small" color="ink2">{b.instructorName ? `Instrutor: ${b.instructorName}` : "Sem instrutor"}</Text>}
                    {b.replacesDate && <Text variant="small" color="accent">Reposição</Text>}
                    <ModalityTag modality={b.modalityKey} label={b.label} />
                  </View>
                  <StatusChip status={b.status} />
                </Card>
              </Pressable>
            ))}
          </View>
          {noted.map(([modalityId, key]) => (
            <NoteBlock key={modalityId} date={first.date} hour={first.hour} modalityId={modalityId} title={noted.length > 1 ? `Notas da turma · ${MODALITY_LABELS[key]}` : "Notas da turma"} />
          ))}
        </>
      )}
    </Sheet>
  );
}
