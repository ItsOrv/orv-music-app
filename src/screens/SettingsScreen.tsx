import React, { useState, useEffect } from "react";
import { View, Text, TouchableOpacity, StyleSheet, Alert, ActivityIndicator, Switch } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Constants from "expo-constants";
import * as Google from "expo-auth-session/providers/google";
import { theme } from "../theme";
import { api, Me } from "../api";
import { googleLink, logout } from "../auth";
import { autoplayOn, setAutoplay } from "../prefs";
import { useToast } from "../ui";

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
        <TouchableOpacity onPress={() => navigation.goBack()}><Text style={styles.back}>‹ Back</Text></TouchableOpacity>
        <Text style={styles.title}>Settings</Text>
        <View style={{ width: 60 }} />
      </View>

      <View style={styles.card}>
        <Text style={styles.label}>Account</Text>
        <Text style={styles.value}>{me.first_name || me.username || me.id}</Text>
        <Text style={styles.sub}>{me.tracks} tracks synced with Telegram</Text>
      </View>

      <AutoplayCard />

      <View style={styles.card}>
        <Text style={styles.label}>Google account</Text>
        <Text style={styles.sub}>{me.google_linked ? "Connected ✓ — sign in with Google from any device" : "Not connected"}</Text>
        {!me.google_linked && googleConfigured && <GoogleLinkButton setMe={setMe} />}
        {!googleConfigured && <Text style={styles.warn}>To enable this, set a Google OAuth client id in app.json.</Text>}
      </View>

      <TouchableOpacity style={styles.logout} onPress={onLogout}><Text style={styles.logoutTxt}>Log out</Text></TouchableOpacity>
    </View>
  );
}

function AutoplayCard() {
  const [on, setOn] = useState(autoplayOn());
  const toast = useToast();
  const flip = async (v: boolean) => {
    setOn(v);
    await setAutoplay(v);
    toast(v ? "Autoplay radio on" : "Autoplay radio off");
  };
  return (
    <View style={styles.card}>
      <View style={styles.toggleRow}>
        <View style={{ flex: 1 }}>
          <Text style={styles.value}>Autoplay radio</Text>
          <Text style={styles.sub}>When the queue ends (and Repeat is off), it keeps going with similar songs.</Text>
        </View>
        <Switch value={on} onValueChange={flip} trackColor={{ false: theme.card2, true: theme.gold }} thumbColor="#ffffff" />
      </View>
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
            Alert.alert("Google", "Google account connected. You can now sign in with Google from any device.");
          })
          .catch(() => Alert.alert("Google", "Couldn't connect your Google account."))
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
      {busy ? <ActivityIndicator color={theme.text} /> : <Text style={styles.btnTxt}>Connect Google account</Text>}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: theme.bg, paddingHorizontal: 16 },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 16 },
  back: { color: theme.gold, fontSize: 15, width: 60 },
  title: { color: theme.text, fontSize: 18, fontWeight: "800" },
  card: { backgroundColor: theme.card, borderRadius: theme.radius, borderWidth: 1, borderColor: theme.line, padding: 16, marginBottom: 12 },
  toggleRow: { flexDirection: "row", alignItems: "center", gap: 12 },
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
