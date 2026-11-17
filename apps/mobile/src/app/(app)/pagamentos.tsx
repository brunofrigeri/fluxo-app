import { listPaymentCycles, type PaymentCycle } from "@fluxo/api";
import { paymentCopy } from "@fluxo/copy";
import { addDays, addMonths, formatMonthYear, formatShort, todayISO } from "@fluxo/domain";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { useMemo, useState } from "react";
import { Pressable, View } from "react-native";
import { PaymentActions } from "@/features/payments/PaymentActions";
import { useMe } from "@/lib/me";
import { supabase } from "@/lib/supabase";
import { Banner } from "@/ui/Banner";
import { Button } from "@/ui/Button";
import { Card } from "@/ui/Card";
import { Empty } from "@/ui/Empty";
import { Icon } from "@/ui/Icon";
import { Pill } from "@/ui/Pill";
import { Screen } from "@/ui/Screen";
import { Seg } from "@/ui/Seg";
import { Text } from "@/ui/Text";

type Filter = "todos" | "atrasados" | "pagos" | "naopagos";
const matches = (c: PaymentCycle, f: Filter) => (f === "pagos" ? c.status === "paid" : f === "naopagos" ? c.status === "unpaid" : f === "atrasados" ? c.overdue : true);

/** Pagamentos (admins): every due date of a month, recorded by hand as paid or not paid. */
export default function Payments() {
  const { isAdmin } = useMe();
  const router = useRouter();
  const today = todayISO();
  const [month, setMonth] = useState(`${today.slice(0, 7)}-01`);
  const [filter, setFilter] = useState<Filter>("todos");
  const monthEnd = addDays(addMonths(month, 1), -1);

  const q = useQuery({ queryKey: ["payments", month], enabled: isAdmin, queryFn: () => listPaymentCycles(supabase, month, monthEnd, today) });
  const cycles = q.data ?? [];
  const count = (f: Filter) => cycles.filter((c) => matches(c, f)).length;
  const byDate = useMemo(() => {
    const map = new Map<string, PaymentCycle[]>();
    for (const c of cycles.filter((x) => matches(x, filter))) map.set(c.dueDate, [...(map.get(c.dueDate) ?? []), c]);
    return [...map.entries()];
  }, [cycles, filter]);

  if (!isAdmin) return <Screen back title={paymentCopy.title}><Empty title="Só para administradores">Os pagamentos do estúdio são vistos apenas por quem o administra.</Empty></Screen>;

  return (
    <Screen
      back
      title={paymentCopy.title}
      refreshing={q.isRefetching}
      onRefresh={() => q.refetch()}
      header={
        <View style={{ gap: 10, paddingBottom: 4 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 20 }}>
            <Pressable accessibilityRole="button" accessibilityLabel="Mês anterior" onPress={() => setMonth(addMonths(month, -1))} hitSlop={10}><Icon name="chevl" size={22} /></Pressable>
            <Pressable accessibilityRole="button" accessibilityLabel="Próximo mês" onPress={() => setMonth(addMonths(month, 1))} hitSlop={10}><Icon name="chevr" size={22} /></Pressable>
            <Text variant="h3" style={{ flex: 1 }}>{formatMonthYear(month)}</Text>
            <Button kind="secondary" label="Este mês" onPress={() => setMonth(`${today.slice(0, 7)}-01`)} />
          </View>
          <Seg<Filter>
            label="Situação"
            value={filter}
            onChange={setFilter}
            items={[{ value: "todos", label: `Todos · ${count("todos")}` }, { value: "atrasados", label: `Em atraso · ${count("atrasados")}` }, { value: "pagos", label: `Pagos · ${count("pagos")}` }, { value: "naopagos", label: `Não pagos · ${count("naopagos")}` }]}
          />
        </View>
      }
    >
      {q.isError && <Banner>{(q.error as Error).message}</Banner>}
      {q.isPending && <Text color="ink2">Carregando…</Text>}
      {q.data && byDate.length === 0 && (
        <Empty title={cycles.length === 0 ? "Nenhum vencimento neste mês" : "Nada com este filtro"}>
          {cycles.length === 0 ? "Defina o dia do pagamento de cada cliente na aba Dados." : "Troque a situação para ver os outros vencimentos."}
        </Empty>
      )}
      {byDate.map(([date, list]) => (
        <Card key={date} style={{ gap: 12 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <Text variant="h3" style={{ flex: 1 }}>{formatShort(date)}</Text>
            {date === today && <Pill accent label="Hoje" />}
          </View>
          {list.map((c) => (
            <View key={c.clientId + c.dueDate} style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
              <Pressable accessibilityRole="link" onPress={() => router.push({ pathname: "/clientes/[id]", params: { id: c.clientId, aba: "pagamentos" } })} style={{ flexShrink: 1 }} hitSlop={6}>
                <Text variant="h3" color="accent">{c.clientName}</Text>
              </Pressable>
              <PaymentActions clientId={c.clientId} dueDate={c.dueDate} status={c.status} overdue={c.overdue} />
            </View>
          ))}
        </Card>
      ))}
      <Text variant="small" color="ink3">O Fluxo não cobra nem recebe pagamentos: você registra o que o cliente pagou. O que passar do vencimento sem registro aparece na Home como “Em atraso”.</Text>
    </Screen>
  );
}
