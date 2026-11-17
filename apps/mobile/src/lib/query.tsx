import { QueryClient, QueryClientProvider, focusManager } from "@tanstack/react-query";
import { AppState } from "react-native";
import type { ReactNode } from "react";

// Reads are cached and refreshed when the app comes back to the foreground; a screen shows what it has at once
// and updates in place. Writes are never retried automatically (a retried booking could double-submit).
export const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 30_000, retry: 1 }, mutations: { retry: 0 } },
});

AppState.addEventListener("change", (state) => focusManager.setFocused(state === "active"));

export function QueryProvider({ children }: { children: ReactNode }) {
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}
