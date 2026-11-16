import { Stack } from "expo-router";
import { MeGate } from "@/lib/me";

export default function AppLayout() {
  return (
    <MeGate>
      <Stack screenOptions={{ headerShown: false }} />
    </MeGate>
  );
}
