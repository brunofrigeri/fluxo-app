import { FIRST_HOUR, getAgendaBookings, getDialogClients, getInstructorsByModality, LAST_HOUR, monthCellLabel, pickModality, rangeFor, type AgendaBooking, type View as AgendaView } from "@fluxo/api";
import { statusLabels, unmarkedLabel } from "@fluxo/copy";
import { dayNumber, formatWeekdayDate, todayISO, type AttendanceStatus } from "@fluxo/domain";
import { MODALITY_LABELS } from "@fluxo/forms";
import { useQuery } from "@tanstack/react-query";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { Pressable, View } from "react-native";
import { AddBookingSheet, type AddInitial } from "@/features/agenda/AddBookingSheet";
import { BookingSheet } from "@/features/agenda/BookingSheet";
import { ClassSheet } from "@/features/agenda/ClassSheet";
import { useMe } from "@/lib/me";
import { supabase } from "@/lib/supabase";
import { Banner } from "@/ui/Banner";
import { Button } from "@/ui/Button";
import { Card } from "@/ui/Card";
import { Icon } from "@/ui/Icon";
import { Pill } from "@/ui/Pill";
import { Screen } from "@/ui/Screen";
import { Seg } from "@/ui/Seg";
import { statusColors } from "@/ui/status";
import { Text } from "@/ui/Text";
import { useTheme } from "@/ui/theme";

type Who = "all" | "mine" | "none" | string;
const VIEWS: { value: AgendaView; label: string }[] = [
  { value: "dia", label: "Dia" },
  { value: "3dias", label: "3 dias" },
  { value: "semana", label: "Semana" },
  { value: "mes", label: "Mês" },
];
const HEADS = ["SEG", "TER", "QUA", "QUI", "SEX", "SÁB", "DOM"];
const ORDER: (AttendanceStatus | null)[] = ["PRESENCE_CONFIRMED", "REPLACEMENT", "JUSTIFIED_MISS", "UNJUSTIFIED_MISS", null];

export default function Agenda() {
  const { me, isAdmin, studioModalities } = useMe();
  const theme = useTheme();
  const router = useRouter();
  const params = useLocalSearchParams<{ novo?: string; cliente?: string; reposicao?: string }>();
  const today = todayISO();

  const [view, setView] = useState<AgendaView>("dia");
  const [anchor, setAnchor] = useState<string | undefined>(undefined);
  const [mod, setMod] = useState("all");
  const [who, setWho] = useState<Who>("all");
  const [classAt, setClassAt] = useState<{ date: string; hour: number } | null>(null);
  const [bookingId, setBookingId] = useState<string | null>(null);
  const [add, setAdd] = useState<AddInitial | null>(null);

  const filter = mod === "all" ? null : pickModality(mod, studioModalities);
  const range = useMemo(() => rangeFor(view, anchor), [view, anchor]);

  const q = useQuery({ queryKey: ["agenda", view, range.anchor, filter?.id ?? null], queryFn: () => getAgendaBookings(supabase, range.from, range.to, filter?.id) });
  // Warm the client list so "Adicionar cliente" opens with its content already in hand.
  const dialogClients = useQuery({ queryKey: ["dialog-clients"], queryFn: () => getDialogClients(supabase), staleTime: 60_000 });
  const instructorsQ = useQuery({
    queryKey: ["instructors"],
    enabled: isAdmin,
    staleTime: 5 * 60_000,
    queryFn: async () => [...new Map([...(await getInstructorsByModality(supabase)).values()].flat().map((i) => [i.id, i])).values()].sort((a, b) => a.name.localeCompare(b.name)),
  });

  // Deep link from Home ("Agendar reposição"): open the add sheet for that client and miss, once.
  useEffect(() => {
    if (!params.novo) return;
    const miss = dialogClients.data?.find((c) => c.id === params.cliente)?.misses.find((x) => x.id === params.reposicao);
    setAdd({ date: today, hour: 7, clientId: params.cliente, missId: params.reposicao, modalityId: miss?.modalityId ?? filter?.id });
    router.setParams({ novo: undefined, cliente: undefined, reposicao: undefined });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.novo]);

  const bookings = q.data ?? [];
  const visible = useMemo(
    () =>
      bookings.filter((b) => {
        if (who === "all") return true;
        if (who === "mine") return b.instructorId === me.id;
        if (who === "none") return Boolean(b.modalityKey) && b.instructorId === null;
        return b.instructorId === who;
      }),
    [bookings, who, me.id],
  );
  const byDate = useMemo(() => {
    const map = new Map<string, AgendaBooking[]>();
    for (const b of visible) map.set(b.date, [...(map.get(b.date) ?? []), b]);
    return map;
  }, [visible]);

  const live = (id: string | null) => (id ? (bookings.find((b) => b.id === id) ?? null) : null);
  const classBookings = classAt ? visible.filter((b) => b.date === classAt.date && b.hour === classAt.hour) : [];
  const others = (instructorsQ.data ?? []).filter((i) => i.id !== me.id);

  function changeView(next: AgendaView) {
    // leaving the month keeps today; going to it keeps the date being looked at
    setAnchor(next === "mes" ? range.anchor : view === "mes" ? undefined : range.anchor);
    setView(next);
  }

  const header = (
    <View style={{ gap: 10, paddingBottom: 4 }}>
      <Seg label="Visualização" value={view} onChange={changeView} items={VIEWS} />
      {studioModalities.length > 1 && <Seg label="Modalidade" value={mod} onChange={setMod} items={[{ value: "all", label: "Todas" }, ...studioModalities.map((m) => ({ value: m.key, label: m.name }))]} />}
      {isAdmin && (
        <Seg
          label="Instrutor"
          value={who}
          onChange={setWho}
          items={[{ value: "all", label: "Todos" }, { value: "mine", label: "Só minhas" }, ...others.map((i) => ({ value: i.id, label: i.name.split(" ")[0] })), { value: "none", label: "Sem instrutor" }]}
        />
      )}
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 20 }}>
        <Pressable accessibilityRole="button" accessibilityLabel="Anterior" onPress={() => setAnchor(range.prev)} hitSlop={10}><Icon name="chevl" size={22} /></Pressable>
        <Pressable accessibilityRole="button" accessibilityLabel="Próximo" onPress={() => setAnchor(range.next)} hitSlop={10}><Icon name="chevr" size={22} /></Pressable>
        <Text variant="h3" style={{ flex: 1 }}>{range.title}</Text>
        <Button kind="secondary" label="Hoje" onPress={() => setAnchor(undefined)} />
      </View>
    </View>
  );

  return (
    <Screen title="Agenda" right={<Button label="Adicionar" onPress={() => setAdd({ date: range.days.includes(today) ? today : range.days[0], hour: 7, modalityId: filter?.id })} />} refreshing={q.isRefetching} onRefresh={() => q.refetch()} header={header}>
      {q.isError && <Banner>{(q.error as Error).message}</Banner>}
      {q.isPending && <Text color="ink2">Carregando…</Text>}

      {q.data && view === "mes" && (
        <MonthGrid days={range.days} anchor={range.anchor} today={today} byDate={byDate} onPick={(d) => { setAnchor(d); setView("dia"); }} />
      )}

      {q.data && view !== "mes" &&
        range.days.map((day) => {
          const list = byDate.get(day) ?? [];
          const hours = [...new Set(list.map((b) => b.hour))].sort((a, b) => a - b);
          return (
            <View key={day} style={{ gap: 8 }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                <Text variant="h3" style={{ flex: 1 }}>{formatWeekdayDate(day)}</Text>
                {day === today && <Pill accent label="Hoje" />}
                <Pressable accessibilityRole="button" accessibilityLabel={`Adicionar cliente em ${formatWeekdayDate(day)}`} onPress={() => setAdd({ date: day, hour: FIRST_HOUR + 1, modalityId: filter?.id })} hitSlop={10}>
                  <Icon name="plus" size={22} color={theme.accent} />
                </Pressable>
              </View>
              {hours.length === 0 && <Text variant="small" color="ink3">Sem sessões</Text>}
              {hours.map((h) => {
                const slot = list.filter((b) => b.hour === h);
                return (
                  <Card key={h} style={{ gap: 10 }}>
                    <Pressable accessibilityRole="button" accessibilityLabel={`Ver turma das ${String(h).padStart(2, "0")}:00`} onPress={() => setClassAt({ date: day, hour: h })} style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                      <Text variant="h2">{slot[0].time}</Text>
                      <Text variant="small" color="ink2" style={{ flex: 1 }}>{slot.length === 1 ? "1 cliente" : `${slot.length} clientes`}</Text>
                      <Pressable accessibilityRole="button" accessibilityLabel="Adicionar cliente neste horário" onPress={() => setAdd({ date: day, hour: h, modalityId: filter?.id })} hitSlop={10}>
                        <Icon name="plus" size={20} color={theme.accent} />
                      </Pressable>
                    </Pressable>
                    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                      {slot.map((b) => {
                        const c = statusColors(theme, b.status);
                        const missed = b.status === "JUSTIFIED_MISS" || b.status === "UNJUSTIFIED_MISS";
                        return (
                          <Pressable
                            key={b.id}
                            accessibilityRole="button"
                            accessibilityLabel={`${b.name}, ${b.modalityKey ? MODALITY_LABELS[b.modalityKey] : (b.label ?? "Atividade")}, ${b.status ? statusLabels[b.status] : unmarkedLabel}`}
                            onPress={() => setBookingId(b.id)}
                            style={{ flexDirection: "row", alignItems: "center", gap: 6, minHeight: 36, paddingHorizontal: 10, borderRadius: 10, backgroundColor: c.bg, opacity: missed ? 0.8 : 1 }}
                          >
                            <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: c.dot }} />
                            <Text variant="small" style={{ color: c.fg, fontWeight: "600", textDecorationLine: missed ? "line-through" : "none" }}>{b.name}</Text>
                            {isAdmin && who === "all" && b.modalityKey && <Text variant="small" style={{ color: c.fg }}>· {b.instructorName ? b.instructorName.split(" ")[0] : "sem instrutor"}</Text>}
                          </Pressable>
                        );
                      })}
                    </View>
                  </Card>
                );
              })}
            </View>
          );
        })}

      <Legend />

      <ClassSheet bookings={classBookings} onClose={() => setClassAt(null)} isAdmin={isAdmin} onPick={(b) => { setClassAt(null); setBookingId(b.id); }} />
      <BookingSheet booking={live(bookingId)} onClose={() => setBookingId(null)} isAdmin={isAdmin} />
      <AddBookingSheet initial={add} onClose={() => setAdd(null)} />
    </Screen>
  );
}

function Legend() {
  const theme = useTheme();
  return (
    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 14, paddingTop: 4 }}>
      {([...ORDER] as (AttendanceStatus | null)[]).map((s) => (
        <View key={s ?? "none"} style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
          <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: statusColors(theme, s).dot }} />
          <Text variant="small" color="ink2">{s ? statusLabels[s] : unmarkedLabel}</Text>
        </View>
      ))}
    </View>
  );
}

function MonthGrid({ days, anchor, today, byDate, onPick }: { days: string[]; anchor: string; today: string; byDate: Map<string, AgendaBooking[]>; onPick: (day: string) => void }) {
  const theme = useTheme();
  return (
    <View style={{ borderRadius: 16, borderWidth: 1, borderColor: theme.line, backgroundColor: theme.surface, overflow: "hidden" }}>
      <View style={{ flexDirection: "row", borderBottomWidth: 1, borderBottomColor: theme.line }}>
        {HEADS.map((h) => (
          <View key={h} style={{ flex: 1, paddingVertical: 8, alignItems: "center" }}>
            <Text variant="tiny" color="ink3">{h}</Text>
          </View>
        ))}
      </View>
      <View style={{ flexDirection: "row", flexWrap: "wrap" }}>
        {days.map((day) => {
          const list = byDate.get(day) ?? [];
          const inMonth = day.slice(0, 7) === anchor.slice(0, 7);
          const isToday = day === today;
          const kinds = ORDER.filter((s) => list.some((b) => b.status === s));
          return (
            <Pressable
              key={day}
              accessibilityRole="button"
              accessibilityLabel={`${dayNumber(day)}, ${monthCellLabel(list.length)}`}
              onPress={() => onPick(day)}
              style={{ width: `${100 / 7}%`, minHeight: 64, padding: 4, alignItems: "center", gap: 2, borderTopWidth: 1, borderTopColor: theme.line, opacity: inMonth ? 1 : 0.4 }}
            >
              <View style={{ minWidth: 26, height: 26, borderRadius: 13, alignItems: "center", justifyContent: "center", backgroundColor: isToday ? theme.accent : "transparent" }}>
                <Text variant="small" style={{ fontWeight: "700", color: isToday ? theme.accentInk : theme.ink }}>{dayNumber(day)}</Text>
              </View>
              {list.length > 0 && <Text variant="tiny" color="ink2" style={{ letterSpacing: 0 }}>{list.length}</Text>}
              <View style={{ flexDirection: "row", gap: 3, flexWrap: "wrap", justifyContent: "center" }}>
                {kinds.map((s) => (
                  <View key={s ?? "none"} style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: statusColors(theme, s).dot }} />
                ))}
              </View>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}
