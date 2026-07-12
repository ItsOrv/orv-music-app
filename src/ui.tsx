import React, { createContext, useContext, useRef, useState, useCallback } from "react";
import { View, Text, Image, TouchableOpacity, StyleSheet, Animated } from "react-native";
import { theme } from "./theme";
import { Track, coverUrl } from "./api";

export function fmt(ms: number): string {
  const s = Math.floor((ms || 0) / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

export function Cover({ track, size = 48, radius = theme.radiusSm }: { track: Track; size?: number; radius?: number }) {
  const uri = coverUrl(track);
  return (
    <View style={[styles.cover, { width: size, height: size, borderRadius: radius }]}>
      {uri ? <Image source={{ uri }} style={{ width: "100%", height: "100%" }} /> : <Text style={{ color: theme.muted2, fontSize: size * 0.36 }}>♪</Text>}
    </View>
  );
}

export function TrackRow({
  track, active, onPress, right,
}: {
  track: Track;
  active?: boolean;
  onPress: () => void;
  right?: React.ReactNode;
}) {
  return (
    <TouchableOpacity style={styles.row} onPress={onPress} activeOpacity={0.7}>
      <Cover track={track} />
      <View style={{ flex: 1 }}>
        <Text numberOfLines={1} style={[styles.t, active && { color: theme.gold }]}>{track.title || "بی‌نام"}</Text>
        {!!track.artist && <Text numberOfLines={1} style={styles.a}>{track.artist}</Text>}
      </View>
      {right}
    </TouchableOpacity>
  );
}

export function SectionHeader({ children }: { children: React.ReactNode }) {
  return (
    <View style={styles.sec}>
      <View style={styles.secTick} />
      <Text style={styles.secTxt}>{children}</Text>
    </View>
  );
}

// ---------- toast ----------
const ToastCtx = createContext<(msg: string) => void>(() => {});
export const useToast = () => useContext(ToastCtx);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [msg, setMsg] = useState<string | null>(null);
  const opacity = useRef(new Animated.Value(0)).current;
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const toast = useCallback((m: string) => {
    setMsg(m);
    Animated.timing(opacity, { toValue: 1, duration: 160, useNativeDriver: true }).start();
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      Animated.timing(opacity, { toValue: 0, duration: 260, useNativeDriver: true }).start(() => setMsg(null));
    }, 1900);
  }, [opacity]);

  return (
    <ToastCtx.Provider value={toast}>
      {children}
      {msg && (
        <Animated.View pointerEvents="none" style={[styles.toast, { opacity }]}>
          <Text style={styles.toastTxt}>{msg}</Text>
        </Animated.View>
      )}
    </ToastCtx.Provider>
  );
}

export const iconBtn = StyleSheet.create({
  add: { color: theme.gold, fontSize: 24, paddingHorizontal: 8, paddingVertical: 6, fontWeight: "700" },
  plays: { color: theme.gold2, fontSize: 11, fontWeight: "700", borderWidth: 1, borderColor: theme.line, borderRadius: 7, paddingHorizontal: 7, paddingVertical: 3, overflow: "hidden" },
});

const styles = StyleSheet.create({
  cover: { backgroundColor: theme.card2, alignItems: "center", justifyContent: "center", overflow: "hidden" },
  row: { flexDirection: "row", alignItems: "center", paddingVertical: 8, gap: 12 },
  t: { color: theme.text, fontSize: 15, fontWeight: "600", textAlign: "right" },
  a: { color: theme.muted, fontSize: 12.5, marginTop: 3, textAlign: "right" },
  sec: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 20, marginBottom: 8 },
  secTick: { width: 3, height: 15, borderRadius: 2, backgroundColor: theme.gold },
  secTxt: { color: theme.text, fontSize: 15, fontWeight: "800", textAlign: "right" },
  toast: { position: "absolute", bottom: 150, alignSelf: "center", backgroundColor: theme.card2, borderWidth: 1, borderColor: theme.line, borderRadius: 999, paddingHorizontal: 18, paddingVertical: 11, maxWidth: "88%" },
  toastTxt: { color: theme.text, fontSize: 13, textAlign: "center" },
});
