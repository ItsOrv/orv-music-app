import React, { useState, useEffect } from "react";
import { View, Text, TouchableOpacity, ActivityIndicator, StyleSheet, Alert } from "react-native";
import * as Linking from "expo-linking";
import * as Clipboard from "expo-clipboard";
import Constants from "expo-constants";
import * as Google from "expo-auth-session/providers/google";
import { theme } from "../theme";
import { startPairing, pollPairing, googleLogin } from "../auth";
import { Me } from "../api";

const extra = (Constants.expoConfig?.extra ?? {}) as Record<string, string>;
const googleConfigured = !!(extra.googleExpoClientId || extra.googleIosClientId || extra.googleAndroidClientId || extra.googleWebClientId);

export default function LoginScreen({ onSignedIn }: { onSignedIn: (m: Me) => void }) {
  const [busy, setBusy] = useState<"tg" | "google" | null>(null);
  const [link, setLink] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const onTelegram = async () => {
    setBusy("tg");
    setCopied(false);
    try {
      const s = await startPairing();
      setLink(s.link);
      Linking.openURL(s.link).catch(() => {}); // best-effort; user can also copy the link below
      const me = await pollPairing(s.code); // waits until the user taps Start in the bot
      onSignedIn(me);
    } catch (e: any) {
      Alert.alert("اتصال", e?.message === "expired" ? "کد منقضی شد، دوباره «اتصال با تلگرام» رو بزن." : "اتصال کامل نشد، دوباره امتحان کن.");
      setLink(null);
    } finally {
      setBusy(null);
    }
  };

  const copy = async () => {
    if (!link) return;
    await Clipboard.setStringAsync(link);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
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

      {link && (
        <View style={styles.panel}>
          <Text style={styles.panelTitle}>اگه تلگرام خودش باز نشد:</Text>
          <Text style={styles.panelStep}>لینکو کپی کن، تو تلگرام بازش کن (یا برای ربات بفرست) و Start رو بزن. بعد برگرد همینجا.</Text>
          <Text style={styles.linkBox} selectable numberOfLines={1} ellipsizeMode="middle">{link}</Text>
          <View style={styles.panelRow}>
            <TouchableOpacity style={[styles.smBtn, styles.smBtnGold]} onPress={copy}>
              <Text style={styles.smBtnGoldTxt}>{copied ? "کپی شد ✓" : "کپی لینک"}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.smBtn} onPress={() => link && Linking.openURL(link).catch(() => {})}>
              <Text style={styles.smBtnTxt}>باز کردن تلگرام</Text>
            </TouchableOpacity>
          </View>
          <View style={styles.waiting}>
            <ActivityIndicator color={theme.gold} size="small" />
            <Text style={styles.waitingTxt}>منتظرِ تایید تو تلگرام…</Text>
          </View>
        </View>
      )}

      {!link && (googleConfigured ? (
        <GoogleLoginButton busy={busy} setBusy={setBusy} onSignedIn={onSignedIn} />
      ) : (
        <View style={[styles.btn, styles.google, styles.disabled]}>
          <Text style={styles.googleTxt}>ورود با گوگل</Text>
        </View>
      ))}

      {!link && (
        <Text style={styles.hint}>
          «اتصال با تلگرام» بازت می‌کنه تو رباتِ @OrvMusicBot؛ Start رو بزن و برگرد — کتابخونه‌ت خودکار سینک می‌شه.
        </Text>
      )}
    </View>
  );
}

// Isolated so the Google auth hook is only ever mounted when client IDs exist
// (useAuthRequest throws invariantClientId otherwise, which would crash the app).
function GoogleLoginButton({
  busy, setBusy, onSignedIn,
}: {
  busy: "tg" | "google" | null;
  setBusy: (v: "tg" | "google" | null) => void;
  onSignedIn: (m: Me) => void;
}) {
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

  return (
    <TouchableOpacity
      style={[styles.btn, styles.google, !request && styles.disabled]}
      onPress={() => promptAsync()}
      disabled={busy !== null || !request}
      activeOpacity={0.85}
    >
      {busy === "google" ? <ActivityIndicator color={theme.text} /> : <Text style={styles.googleTxt}>ورود با گوگل</Text>}
    </TouchableOpacity>
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
  panel: { backgroundColor: theme.card, borderRadius: theme.radius, borderWidth: 1, borderColor: theme.line, padding: 16, gap: 10 },
  panelTitle: { color: theme.text, fontSize: 14, fontWeight: "800", textAlign: "right" },
  panelStep: { color: theme.muted, fontSize: 12.5, lineHeight: 20, textAlign: "right" },
  linkBox: { color: theme.gold, fontSize: 12.5, backgroundColor: theme.bg2, borderRadius: theme.radiusSm, borderWidth: 1, borderColor: theme.line, paddingHorizontal: 12, paddingVertical: 11, textAlign: "left" },
  panelRow: { flexDirection: "row", gap: 8 },
  smBtn: { flex: 1, height: 44, borderRadius: theme.radiusSm, alignItems: "center", justifyContent: "center", backgroundColor: theme.card2, borderWidth: 1, borderColor: theme.line },
  smBtnTxt: { color: theme.text, fontSize: 13.5, fontWeight: "700" },
  smBtnGold: { backgroundColor: theme.gold, borderColor: theme.gold },
  smBtnGoldTxt: { color: "#17130c", fontSize: 13.5, fontWeight: "800" },
  waiting: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, marginTop: 2 },
  waitingTxt: { color: theme.muted, fontSize: 12.5 },
});
