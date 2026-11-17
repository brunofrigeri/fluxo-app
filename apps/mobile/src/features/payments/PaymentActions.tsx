import { paymentLabels } from "@fluxo/copy";
import type { PaymentStatus } from "@fluxo/domain";
import { setPaymentStatus } from "@fluxo/api";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Pressable, View } from "react-native";
import { supabase } from "@/lib/supabase";
import { useToast } from "@/lib/toast";
import { Text } from "@/ui/Text";
import { useTheme } from "@/ui/theme";

/** How a due date reads: recorded, late because nobody recorded it, or still ahead. */
export function paymentTone(status: PaymentStatus, overdue: boolean): { tone: "ok" | "um" | "jm" | "none"; label: string } {
  if (status === "paid") return { tone: "ok", label: paymentLabels.paid };
  if (status === "unpaid") return { tone: "um", label: paymentLabels.unpaid };
  if (overdue) return { tone: "jm", label: paymentLabels.overdue };
  return { tone: "none", label: paymentLabels.upcoming };
}

export function usePaymentColors() {
  const t = useTheme();
  return (tone: "ok" | "um" | "jm" | "none") => (tone === "none" ? { bg: t.stone, fg: t.ink2, dot: t.lineStrong } : { bg: t[`${tone}Bg`], fg: t[`${tone}Fg`], dot: t[`${tone}Dot`] });
}

export function PaymentChip({ status, overdue }: { status: PaymentStatus; overdue: boolean }) {
  const color = usePaymentColors();
  const { tone, label } = paymentTone(status, overdue);
  const c = color(tone);
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 6, height: 28, paddingHorizontal: 10, borderRadius: 999, backgroundColor: c.bg, alignSelf: "flex-start" }}>
      <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: c.dot }} />
      <Text variant="small" style={{ color: c.fg }}>{label}</Text>
    </View>
  );
}

/** Every screen that shows payments. A recorded change refreshes all of them. */
export const PAYMENT_QUERIES = ["payments", "client-payments", "home", "agenda-payments"] as const;

/**
 * The status of one due date with the two manual actions. The chip changes on the tap and goes back with a toast if
 * the server refuses, so nothing waits on the network. Pressing the active choice clears the record.
 */
export function PaymentActions({ clientId, dueDate, status: serverStatus, overdue }: { clientId: string; dueDate: string; status: PaymentStatus; overdue: boolean }) {
  const theme = useTheme();
  const qc = useQueryClient();
  const toast = useToast();
  const [status, setStatus] = useState(serverStatus);
  useEffect(() => setStatus(serverStatus), [serverStatus]);

  function choose(next: PaymentStatus) {
    const target = status === next ? "pending" : next;
    const previous = status;
    setStatus(target);
    void setPaymentStatus(supabase, { clientId, dueDate, status: target }).then((r) => {
      if (r.error) {
        setStatus(previous);
        toast(r.error);
      }
      for (const k of PAYMENT_QUERIES) qc.invalidateQueries({ queryKey: [k] });
    });
  }

  const opts: { value: PaymentStatus; label: string }[] = [{ value: "paid", label: paymentLabels.paid }, { value: "unpaid", label: paymentLabels.unpaid }];
  return (
    <View style={{ gap: 8, alignItems: "flex-end" }}>
      <PaymentChip status={status} overdue={overdue} />
      <View style={{ flexDirection: "row", padding: 3, borderRadius: 12, backgroundColor: theme.stone, gap: 2 }}>
        {opts.map((o) => {
          const on = status === o.value;
          return (
            <Pressable key={o.value} accessibilityRole="button" accessibilityState={{ selected: on }} accessibilityLabel={`${o.label}: ${dueDate}`} onPress={() => choose(o.value)} style={{ height: 36, paddingHorizontal: 14, borderRadius: 9, justifyContent: "center", backgroundColor: on ? theme.surface : "transparent" }}>
              <Text variant="small" style={{ fontWeight: "600", color: on ? theme.ink : theme.ink2 }}>{o.label}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}
