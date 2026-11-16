import { auth, brand } from "@fluxo/copy";
import { useState } from "react";
import { KeyboardAvoidingView, Platform, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { supabase } from "@/lib/supabase";
import { Button } from "@/ui/Button";
import { Text } from "@/ui/Text";
import { useTheme } from "@/ui/theme";

export default function Login() {
  const theme = useTheme();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState(false);
  const [busy, setBusy] = useState(false);

  async function submit() {
    setBusy(true);
    setError(false);
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    // On success the session listener swaps this screen for the app; only a failure needs handling here.
    if (error) setError(true);
    setBusy(false);
  }

  const input = {
    height: 46,
    paddingHorizontal: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: error ? theme.umDot : theme.line,
    backgroundColor: theme.surface,
    color: theme.ink,
    fontSize: 15,
  } as const;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.bg }}>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1, justifyContent: "center", padding: 24, gap: 28 }}>
        <Text variant="display" style={{ textAlign: "center" }}>{brand.name}</Text>
        <View style={{ gap: 16, padding: 24, borderRadius: 16, borderWidth: 1, borderColor: theme.line, backgroundColor: theme.surface }}>
          <View style={{ gap: 4 }}>
            <Text variant="h1">{auth.signIn}</Text>
            <Text color="ink2">{auth.signInHint}</Text>
          </View>
          {error && (
            <View accessibilityRole="alert" style={{ padding: 12, borderRadius: 12, backgroundColor: theme.umBg }}>
              <Text style={{ color: theme.umFg }}>{auth.wrongCredentials}</Text>
            </View>
          )}
          <View style={{ gap: 6 }}>
            <Text variant="small" color="ink2">{auth.email}</Text>
            <TextInput style={input} value={email} onChangeText={setEmail} autoCapitalize="none" autoComplete="email" keyboardType="email-address" textContentType="emailAddress" />
          </View>
          <View style={{ gap: 6 }}>
            <Text variant="small" color="ink2">{auth.password}</Text>
            <TextInput style={input} value={password} onChangeText={setPassword} secureTextEntry autoComplete="current-password" textContentType="password" onSubmitEditing={submit} />
          </View>
          <Button label={busy ? auth.signingIn : auth.signIn} onPress={submit} disabled={busy || !email || !password} />
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
