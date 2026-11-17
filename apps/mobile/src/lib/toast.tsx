import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Text } from "@/ui/Text";
import { useTheme } from "@/ui/theme";

type Kind = "error" | "info";
type Toast = { id: number; message: string; kind: Kind };
const Ctx = createContext<(message: string, kind?: Kind) => void>(() => {});

/** A short message at the bottom of the screen: where an optimistic change reports that the server said no. */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [toast, setToast] = useState<Toast | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const theme = useTheme();
  const insets = useSafeAreaInsets();

  const show = useCallback((message: string, kind: Kind = "error") => {
    if (timer.current) clearTimeout(timer.current);
    setToast({ id: Date.now(), message, kind });
    timer.current = setTimeout(() => setToast(null), 5000);
  }, []);
  useEffect(() => () => void (timer.current && clearTimeout(timer.current)), []);

  return (
    <Ctx.Provider value={show}>
      {children}
      {toast && (
        <View
          pointerEvents="none"
          accessibilityLiveRegion="polite"
          style={{ position: "absolute", left: 16, right: 16, bottom: insets.bottom + 72, padding: 14, borderRadius: 14, backgroundColor: toast.kind === "error" ? theme.umBg : theme.ink, shadowColor: "#000", shadowOpacity: 0.15, shadowRadius: 12, shadowOffset: { width: 0, height: 4 }, elevation: 6 }}
        >
          <Text variant="small" style={{ color: toast.kind === "error" ? theme.umFg : theme.bg, fontWeight: "600" }}>{toast.message}</Text>
        </View>
      )}
    </Ctx.Provider>
  );
}

export const useToast = () => useContext(Ctx);
