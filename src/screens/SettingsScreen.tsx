import React, { useState, useEffect } from "react";
import { View, Text, TouchableOpacity, StyleSheet, Alert, ActivityIndicator } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Constants from "expo-constants";
import * as Google from "expo-auth-session/providers/google";
import { theme } from "../theme";
import { api, Me } from "../api";
import { googleLink, logout } from "../auth";

const extra = (Constants.expoConfig?.extra ?? {}) as Record<string, string>;
const googleConfigured = !!(extra.googleExpoClientId || extra.googleIosClientId || extra.googleAndroidClientId || extra.googleWebClientId);

export default function SettingsScreen({ navigation, me, setMe }: { navigation: any; me: Me; setMe: (m: Me | null) => void }) {
  const insets = useSafeAreaInsets();

  const onLogout = async () => {
    await logout();
    setMe(null);
  };

  return (
    <View style={[styles.wrap, { paddingTop: insets.top + 8 }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}><Text style={styles.back}>‹ برگشت</Text></TouchableOpacity>
        <Text style={styles.title}>تنظیمات</Text>
        <View style={{ width: 60 }} />
      </View>

      <View style={styles.card}>
        <Text style={styles.label}>حساب</Text>
        <Text style={styles.value}>{me.first_name || me.username || me.id}</Text>
        <Text style={styles.sub}>{me.tracks} آهنگ سینک‌شده با تلگرام</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.label}>حساب گوگل</Text>
        <Text style={styles.sub}>{me.google_linked ? "وصل شده ✓ — از هر دستگاهی با گوگل وارد شو" : "وصل نیست"}</Text>
        {!me.google_linked && googleConfigured && <GoogleLinkButton setMe={setMe} />}
        {!googleConfigured && <Text style={styles.warn}>برای فعال‌شدن، Google OAuth client id توی app.json ست بشه.</Text>}
      </View>

      <TouchableOpacity style={styles.logout} onPress={onLogout}><Text style={styles.logoutTxt}>خروج</Text></TouchableOpacity>
    </View>
  );
}

// Google auth hook lives here so it only mounts when client IDs are configured.
function GoogleLinkButton({ setMe }: { setMe: (m: Me | null) => void }) {
  const [busy, setBusy] = useState(false);
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
        setBusy(true);
        googleLink(idToken)
          .then(async () => {
            setMe(await api<Me>("me"));
            Alert.alert("گوگل", "حساب گوگل وصل شد. حالا از هر دستگاهی با گوگل وارد شو.");
          })
          .catch(() => Alert.alert("گوگل", "اتصال حساب گوگل انجام نشد."))
          .finally(() => setBusy(false));
      }
    }
  }, [response]);

  return (
    <TouchableOpacity
      style={[styles.btn, !request && styles.disabled]}
      onPress={() => promptAsync()}
      disabled={busy || !request}
    >
      {busy ? <ActivityIndicator color={theme.text} /> : <Text style={styles.btnTxt}>اتصال حساب گوگل</Text>}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: theme.bg, paddingHorizontal: 16 },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 16 },
  back: { color: theme.gold, fontSize: 15, width: 60 },
  title: { color: theme.text, fontSize: 18, fontWeight: "800" },
  card: { backgroundColor: theme.card, borderRadius: theme.radius, borderWidth: 1, borderColor: theme.line, padding: 16, marginBottom: 12 },
  label: { color: theme.muted, fontSize: 12, marginBottom: 6 },
  value: { color: theme.text, fontSize: 16, fontWeight: "700" },
  sub: { color: theme.muted, fontSize: 13, marginTop: 6, lineHeight: 20 },
  btn: { backgroundColor: theme.card2, borderRadius: theme.radiusSm, borderWidth: 1, borderColor: theme.line, height: 46, alignItems: "center", justifyContent: "center", marginTop: 12 },
  btnTxt: { color: theme.text, fontWeight: "700" },
  disabled: { opacity: 0.4 },
  warn: { color: theme.muted2, fontSize: 11.5, marginTop: 10, lineHeight: 18 },
  logout: { marginTop: 8, height: 48, alignItems: "center", justifyContent: "center" },
  logoutTxt: { color: theme.danger, fontSize: 15, fontWeight: "700" },
});
