import { getHomeData, pickModality } from "@fluxo/api";
import { paymentCopy } from "@fluxo/copy";
import { formatBR, formatLong, greeting, isPresent } from "@fluxo/domain";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { useState } from "react";
import { Pressable, View } from "react-native";
import { PaymentActions } from "@/features/payments/PaymentActions";
import { useMe } from "@/lib/me";
import { useSetStatus } from "@/lib/hooks/useSetStatus";
import { supabase } from "@/lib/supabase";
import { Avatar } from "@/ui/Avatar";
import { Banner } from "@/ui/Banner";
import { Button } from "@/ui/Button";
import { Card } from "@/ui/Card";
import { Empty } from "@/ui/Empty";
import { Icon } from "@/ui/Icon";
import { ModalityTag } from "@/ui/ModalityTag";
import { Pill } from "@/ui/Pill";
import { Screen } from "@/ui/Screen";
import { Seg } from "@/ui/Seg";
import { StatusButton, StatusSheet } from "@/ui/StatusSheet";
import { Text } from "@/ui/Text";
import { useTheme } from "@/ui/theme";
import type { AttendanceStatus } from "@fluxo/domain";

type Target = { bookingId: string; name: string; status: AttendanceStatus | null; missReason: string | null };

export default function Home() {
  const { me, studioModalities, isAdmin } = useMe();
  const theme = useTheme();
  const router = useRouter();
  const [mod, setMod] = useState("all");
  const filter = mod === "all" ? null : pickModality(mod, studioModalities);
  const setStatus = useSetStatus();
  const [target, setTarget] = useState<Target | null>(null);

  const q = useQuery({ queryKey: ["home", filter?.id ?? null], queryFn: () => getHomeData(supabase, filter?.id) });
  const data = q.data;
  const many = studioModalities.length > 1;
  const openClient = (id: string) => router.push(`/clientes/${id}`);

  const clientLink = (id: string, name: string) => (
    <Pressable accessibilityRole="link" onPress={() => openClient(id)} hitSlop={6}>
      <Text variant="h3" color="accent">{name}</Text>
    </Pressable>
  );

  return (
    <Screen
      title={`${greeting()}, ${me.firstName}`}
      subtitle={data ? formatLong(data.today) : undefined}
      refreshing={q.isRefetching}
      onRefresh={() => q.refetch()}
      header={
        many ? (
          <View style={{ paddingBottom: 4 }}>
            <Seg label="Modalidade" value={mod} onChange={setMod} items={[{ value: "all", label: "Todas" }, ...studioModalities.map((m) => ({ value: m.key, label: m.name }))]} />
          </View>
        ) : undefined
      }
    >
      {q.isError && <Banner>{(q.error as Error).message}</Banner>}

      {!data && !q.isError && <Text color="ink2">Carregando…</Text>}

      {data && (
        <>
          {/* 1. Sessões de hoje */}
          <Card>
            <Header icon="clock" title="Sessões de hoje" count={data.slots.length === 1 ? "1 horário" : `${data.slots.length} horários`} accent />
            {data.slots.length === 0 ? (
              <Empty title="Dia livre">Nenhuma sessão marcada para hoje.</Empty>
            ) : (
              data.slots.map((slot, i) => (
                <View key={slot.time} style={{ gap: 10, paddingTop: i === 0 ? 0 : 12, borderTopWidth: i === 0 ? 0 : 1, borderTopColor: theme.line }}>
                  <View style={{ flexDirection: "row", alignItems: "baseline", gap: 8 }}>
                    <Text variant="h2">{slot.time}</Text>
                    <Text variant="small" color="ink2">{slot.clients.length === 1 ? "1 cliente" : `${slot.clients.length} clientes`}</Text>
                  </View>
                  {slot.clients.map((c) => (
                    <View key={c.bookingId} style={{ gap: 6 }}>
                      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                        <View style={{ flexShrink: 1, gap: 4 }}>
                          {clientLink(c.clientId, c.name)}
                          {(many || c.label) && <ModalityTag modality={c.modalityKey} label={c.label} />}
                        </View>
                        <StatusButton status={c.status} onPress={() => setTarget({ bookingId: c.bookingId, name: c.name, status: c.status, missReason: c.missReason })} />
                      </View>
                      {c.status === "JUSTIFIED_MISS" && c.missReason && <Text variant="small" color="ink2">Motivo: {c.missReason}</Text>}
                    </View>
                  ))}
                </View>
              ))
            )}
          </Card>

          {/* 2. Pendências de ontem */}
          <Card>
            <Header icon="alert" title="Pendências de ontem" count={data.unmarked.length + data.missingEvolution.length} />
            {data.unmarked.map((p) => (
              <Row key={`u-${p.bookingId}`} name={clientLink(p.clientId, p.name)} detail={p.when}>
                <StatusButton status={null} onPress={() => setTarget({ bookingId: p.bookingId, name: p.name, status: null, missReason: null })} />
              </Row>
            ))}
            {data.missingEvolution.map((p) => (
              <Row key={`e-${p.bookingId}`} name={clientLink(p.clientId, p.name)} detail={p.when}>
                <Button kind="secondary" label="Escrever evolução" onPress={() => router.push({ pathname: "/clientes/[id]/evolucoes/nova", params: { id: p.clientId, sessao: p.bookingId } })} />
              </Row>
            ))}
            {data.unmarked.length + data.missingEvolution.length === 0 && <Empty title="Tudo em dia por aqui">Nenhuma pendência de ontem.</Empty>}
          </Card>

          {/* 3. Reposições a agendar */}
          <Card>
            <Header icon="repeat" title="Reposições a agendar" count={data.toReschedule.length} />
            {data.toReschedule.length === 0 ? (
              <Empty>Nenhuma reposição pendente.</Empty>
            ) : (
              data.toReschedule.map((p) => (
                <Row key={p.bookingId} name={clientLink(p.clientId, p.name)} detail={p.when}>
                  <Button kind="secondary" label="Agendar reposição" onPress={() => router.push({ pathname: "/agenda", params: { novo: "1", cliente: p.clientId, reposicao: p.bookingId } })} />
                </Row>
              ))
            )}
          </Card>

          {/* Pagamentos sem atualização (admins): due dates that passed and were never marked paid. */}
          {isAdmin && (
            <Card>
              <Header icon="archive" title={paymentCopy.homeTitle} count={data.payments.total} />
              {data.payments.items.length === 0 ? (
                <Empty>{paymentCopy.homeEmpty}</Empty>
              ) : (
                <>
                  {data.payments.items.slice(0, 8).map((p) => (
                    <View key={p.clientId} style={{ gap: 8 }}>
                      <Row name={clientLink(p.clientId, p.name)} detail={`Venceu em ${formatBR(p.dueDate)}${p.count > 1 ? ` · ${p.count} vencimentos em aberto` : ""}${p.unpaid ? " · marcado como não pago" : ""}`} />
                      <View style={{ alignItems: "flex-end" }}><PaymentActions clientId={p.clientId} dueDate={p.dueDate} status={p.unpaid ? "unpaid" : "pending"} overdue /></View>
                    </View>
                  ))}
                  {data.payments.total > 8 && <Button kind="secondary" label={`Ver todos (${data.payments.total})`} onPress={() => router.push("/pagamentos")} />}
                </>
              )}
            </Card>
          )}

          {/* 4. Clientes em atenção */}
          <Card>
            <Header icon="users" title="Clientes em atenção" />
            {data.attention.length === 0 ? (
              <Empty>Nenhum cliente em atenção.</Empty>
            ) : (
              data.attention.map((a) => (
                <Row key={a.clientId} name={clientLink(a.clientId, a.name)} detail={a.reason}>
                  <Icon name="chevr" color={theme.ink3} />
                </Row>
              ))
            )}
          </Card>

          {/* 5. Aniversariantes da semana */}
          <Card>
            <Header icon="cake" title="Aniversariantes da semana" accent />
            {data.birthdays.length === 0 ? (
              <Empty>Nenhum aniversário nos próximos 7 dias.</Empty>
            ) : (
              data.birthdays.map((b) => (
                <Row key={b.clientId} lead={<Avatar name={b.name} size={32} />} name={clientLink(b.clientId, b.name)} detail={b.label}>
                  <Icon name="chevr" color={theme.ink3} />
                </Row>
              ))
            )}
          </Card>

          {/* 6. Frequência da semana */}
          <Card>
            <Header icon="check" title="Frequência da semana" accent />
            {data.attendance.rate === null ? (
              <Empty>Ainda não há presenças marcadas nesta semana.</Empty>
            ) : (
              <>
                <View style={{ flexDirection: "row", alignItems: "baseline", gap: 12, flexWrap: "wrap" }}>
                  <Text style={{ fontSize: 48, lineHeight: 52, fontFamily: "Figtree_700Bold", letterSpacing: -1.4 }}>{data.attendance.rate}%</Text>
                  {data.attendance.deltaPoints !== null && data.attendance.deltaPoints !== 0 && (
                    <Pill accent={data.attendance.deltaPoints > 0} label={`${data.attendance.deltaPoints > 0 ? "▲" : "▼"} ${Math.abs(data.attendance.deltaPoints)} ${Math.abs(data.attendance.deltaPoints) === 1 ? "ponto" : "pontos"}`} />
                  )}
                </View>
                <Text variant="small" color="ink2">de presença{data.attendance.deltaPoints !== null ? ", em relação à semana anterior" : " nesta semana"}</Text>
              </>
            )}
          </Card>
        </>
      )}

      <StatusSheet
        open={!!target}
        onClose={() => setTarget(null)}
        clientName={target?.name}
        status={target?.status ?? null}
        missReason={target?.missReason ?? null}
        onSelect={(status, reason) => target && setStatus.mutate({ bookingId: target.bookingId, status, reason })}
      />
    </Screen>
  );
}

function Header({ icon, title, count, accent }: { icon: import("@fluxo/tokens").IconName; title: string; count?: string | number; accent?: boolean }) {
  const theme = useTheme();
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
      <View style={{ width: 32, height: 32, borderRadius: 10, alignItems: "center", justifyContent: "center", backgroundColor: accent ? theme.accentSoft : theme.stone }}>
        <Icon name={icon} size={16} color={accent ? theme.accent : theme.ink2} />
      </View>
      <Text variant="h3" style={{ flex: 1 }}>{title}</Text>
      {count !== undefined && <Pill label={String(count)} />}
    </View>
  );
}

function Row({ name, detail, lead, children }: { name: React.ReactNode; detail: string; lead?: React.ReactNode; children?: React.ReactNode }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
      {lead}
      <View style={{ flex: 1, gap: 2 }}>
        {name}
        <Text variant="small" color="ink2">{detail}</Text>
      </View>
      {children}
    </View>
  );
}
