import { getHomeData, type HomeData } from "@fluxo/api";
import { auth } from "@fluxo/copy";
import { formatWeekdayDate, greeting } from "@fluxo/domain";
import { MODALITY_LABELS } from "@fluxo/forms";
import { useCallback, useEffect, useState } from "react";
import { RefreshControl, ScrollView, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { supabase } from "@/lib/supabase";
import { Button } from "@/ui/Button";
import { StatusChip } from "@/ui/Chip";
import { Text } from "@/ui/Text";
import { useTheme } from "@/ui/theme";

/** Today's sessions, read-only for now. Same query as the web's Home (@fluxo/api), same RLS. */
export default function Today() {
  const theme = useTheme();
  const [data, setData] = useState<HomeData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      setData(await getHomeData(supabase));
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function refresh() {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.bg }}>
      <ScrollView contentContainerStyle={{ padding: 20, gap: 20 }} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} />}>
        <View style={{ gap: 2 }}>
          <Text variant="h1">{greeting()}</Text>
          {data && <Text color="ink2">{formatWeekdayDate(data.today)}</Text>}
        </View>

        {error && (
          <View accessibilityRole="alert" style={{ padding: 12, borderRadius: 12, backgroundColor: theme.umBg }}>
            <Text style={{ color: theme.umFg }}>{error}</Text>
          </View>
        )}

        {data && data.slots.length === 0 && !error && <Text color="ink2">Nenhuma sessão hoje.</Text>}

        {data?.slots.map((slot) => (
          <View key={slot.time} style={{ gap: 8 }}>
            <Text variant="tiny" color="ink3">{slot.time}</Text>
            <View style={{ borderRadius: 16, borderWidth: 1, borderColor: theme.line, backgroundColor: theme.surface }}>
              {slot.clients.map((c, i) => (
                <View key={c.bookingId} style={{ gap: 8, padding: 14, borderTopWidth: i === 0 ? 0 : 1, borderTopColor: theme.line }}>
                  <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
                    <Text variant="h3" style={{ flexShrink: 1 }}>{c.name}</Text>
                    <Text variant="small" color="ink2">{c.modalityKey ? MODALITY_LABELS[c.modalityKey] : c.label}</Text>
                  </View>
                  <StatusChip status={c.status} />
                </View>
              ))}
            </View>
          </View>
        ))}

        <Button kind="secondary" label={auth.signOut} onPress={() => supabase.auth.signOut()} />
      </ScrollView>
    </SafeAreaView>
  );
}
