import React, { useState, useEffect } from "react";
import { View, Text, TouchableOpacity, ActivityIndicator, StyleSheet, Alert } from "react-native";
import Constants from "expo-constants";
import * as Google from "expo-auth-session/providers/google";
import { theme } from "../theme";
import { pairWithTelegram, googleLogin } from "../auth";
import { Me } from "../api";

const extra = (Constants.expoConfig?.extra ?? {}) as Record<string, string>;
const googleConfigured = !!(extra.googleExpoClientId || extra.googleIosClientId || extra.googleAndroidClientId || extra.googleWebClientId);

export default function LoginScreen({ onSignedIn }: { onSignedIn: (m: Me) => void }) {
  const [busy, setBusy] = useState<"tg" | "google" | null>(null);

  const [request, response, promptAsync] = Google.useAuthRequest({
    clientId: extra.googleExpoClientId || undefined,
    iosClientId: extra.googleIosClientId || undefined,
    androidClientId: extra.googleAndroidClientId || undefined,
    webClientId: extra.googleWebClientId || undefined,
  });

  useEffect(() => {
    if (response?.type === "success") {
      const idToken = response.authentication?.idToken || (response.params as any)?.id_token;
      if (idToken) {
        setBusy("google");
        googleLogin(idToken)
          .then(onSignedIn)
          .catch(() => Alert.alert("گوگل", "این حساب گوگل هنوز به هیچ اکانتی وصل نشده. اول با تلگرام وارد شو، بعد از تنظیمات گوگل رو وصل کن."))
          .finally(() => setBusy(null));
      }
    }
  }, [response]);

  const onTelegram = async () => {
    setBusy("tg");
    try {
      const me = await pairWithTelegram();
      onSignedIn(me);
    } catch (e: any) {
      Alert.alert("اتصال", e?.message === "expired" ? "کد منقضی شد، دوباره امتحان کن." : "اتصال کامل نشد، دوباره امتحان کن.");
    } finally {
      setBusy(null);
    }
  };

  return (
    <View style={styles.wrap}>
      <View style={styles.brand}>
        <Text style={styles.logo}>♪</Text>
        <Text style={styles.title}>Orv Music</Text>
        <Text style={styles.sub}>کتابخونه‌ی موزیکت، همه‌جا — سینک با رباتِ تلگرامت</Text>
      </View>

      <TouchableOpacity style={[styles.btn, styles.tg]} onPress={onTelegram} disabled={busy !== null} activeOpacity={0.85}>
        {busy === "tg" ? <ActivityIndicator color="#17130c" /> : <Text style={styles.tgTxt}>اتصال با تلگرام</Text>}
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.btn, styles.google, (!googleConfigured || !request) && styles.disabled]}
        onPress={() => promptAsync()}
        disabled={busy !== null || !googleConfigured || !request}
        activeOpacity={0.85}
      >
        {busy === "google" ? <ActivityIndicator color={theme.text} /> : <Text style={styles.googleTxt}>ورود با گوگل</Text>}
      </TouchableOpacity>

      <Text style={styles.hint}>
        «اتصال با تلگرام» بازت می‌کنه تو رباتِ @OrvMusicBot؛ Start رو بزن و برگرد — کتابخونه‌ت خودکار سینک می‌شه.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: theme.bg, justifyContent: "center", padding: 28, gap: 14 },
  brand: { alignItems: "center", marginBottom: 30 },
  logo: { fontSize: 54, color: theme.gold },
  title: { fontSize: 28, fontWeight: "800", color: theme.text, marginTop: 8, letterSpacing: 0.5 },
  sub: { color: theme.muted, fontSize: 13.5, marginTop: 10, textAlign: "center", lineHeight: 22 },
  btn: { height: 54, borderRadius: theme.radius, alignItems: "center", justifyContent: "center" },
  tg: { backgroundColor: theme.gold },
  tgTxt: { color: "#17130c", fontSize: 16, fontWeight: "800" },
  google: { backgroundColor: theme.card, borderWidth: 1, borderColor: theme.line },
  googleTxt: { color: theme.text, fontSize: 15, fontWeight: "700" },
  disabled: { opacity: 0.4 },
  hint: { color: theme.muted2, fontSize: 12, textAlign: "center", lineHeight: 20, marginTop: 14 },
});
