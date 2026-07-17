import React, { useState } from "react";
import { View, Text, TouchableOpacity, StyleSheet, Modal, Image } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { theme } from "./theme";
import { coverUrl } from "./api";
import { usePlayer } from "./player";
import { fmt } from "./ui";

export default function PlayerBar({ bottomOffset }: { bottomOffset: number }) {
  const p = usePlayer();
  const [full, setFull] = useState(false);
  if (!p.current) return null;
  const cover = coverUrl(p.current);
  return (
    <>
      <TouchableOpacity style={[styles.mini, { bottom: bottomOffset }]} onPress={() => setFull(true)} activeOpacity={0.9}>
        <View style={styles.miniCover}>
          {cover ? <Image source={{ uri: cover }} style={styles.img} /> : <Text style={styles.note}>♪</Text>}
        </View>
        <View style={{ flex: 1 }}>
          <Text numberOfLines={1} style={styles.miniT}>{p.current.title || "—"}</Text>
          {!!p.current.artist && <Text numberOfLines={1} style={styles.miniA}>{p.current.artist}</Text>}
        </View>
        <TouchableOpacity onPress={p.toggle} hitSlop={12}><Text style={styles.miniBtn}>{p.isLoading ? "…" : p.isPlaying ? "❚❚" : "▶"}</Text></TouchableOpacity>
        <TouchableOpacity onPress={p.next} hitSlop={12}><Text style={styles.miniBtn}>⏭</Text></TouchableOpacity>
      </TouchableOpacity>
      <Modal visible={full} animationType="slide" onRequestClose={() => setFull(false)}>
        <FullPlayer onClose={() => setFull(false)} />
      </Modal>
    </>
  );
}

function FullPlayer({ onClose }: { onClose: () => void }) {
  const p = usePlayer();
  const insets = useSafeAreaInsets();
  const cover = p.current ? coverUrl(p.current) : null;
  const pct = p.duration ? Math.min(1, p.position / p.duration) : 0;
  return (
    <View style={[styles.full, { paddingTop: insets.top + 10, paddingBottom: insets.bottom + 24 }]}>
      <TouchableOpacity onPress={onClose} style={styles.close}><Text style={styles.closeTxt}>⌄</Text></TouchableOpacity>
      <View style={styles.art}>
        {cover ? <Image source={{ uri: cover }} style={styles.img} /> : <Text style={styles.artNote}>♪</Text>}
      </View>
      <Text numberOfLines={1} style={styles.fullT}>{p.current?.title || "—"}</Text>
      <Text numberOfLines={1} style={styles.fullA}>{p.current?.artist || ""}</Text>

      <View style={styles.progWrap}>
        <View style={styles.progBar}><View style={[styles.progFill, { width: `${pct * 100}%` }]} /></View>
        <View style={styles.times}>
          <Text style={styles.time}>{fmt(p.position)}</Text>
          <Text style={styles.time}>{fmt(p.duration)}</Text>
        </View>
      </View>

      <View style={styles.controls}>
        <TouchableOpacity onPress={p.toggleShuffle}><Text style={[styles.cBtn, p.shuffle && styles.on]}>🔀</Text></TouchableOpacity>
        <TouchableOpacity onPress={p.prev}><Text style={styles.cBig}>⏮</Text></TouchableOpacity>
        <TouchableOpacity onPress={p.toggle} style={styles.playCircle}>
          <Text style={styles.playIcon}>{p.isLoading ? "…" : p.isPlaying ? "❚❚" : "▶"}</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={p.next}><Text style={styles.cBig}>⏭</Text></TouchableOpacity>
        <TouchableOpacity onPress={p.cycleRepeat}>
          <Text style={[styles.cBtn, p.repeat !== "off" && styles.on]}>{p.repeat === "one" ? "🔂" : "🔁"}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  img: { width: "100%", height: "100%" },
  note: { color: theme.muted2, fontSize: 18 },
  mini: { position: "absolute", left: 12, right: 12, height: 62, backgroundColor: theme.card, borderRadius: theme.radius, borderWidth: 1, borderColor: theme.line, flexDirection: "row", alignItems: "center", paddingHorizontal: 10, gap: 10 },
  miniCover: { width: 42, height: 42, borderRadius: 8, backgroundColor: theme.card2, alignItems: "center", justifyContent: "center", overflow: "hidden" },
  miniT: { color: theme.text, fontSize: 13.5, fontWeight: "600", textAlign: "right" },
  miniA: { color: theme.muted, fontSize: 11.5, marginTop: 2, textAlign: "right" },
  miniBtn: { color: theme.text, fontSize: 18, paddingHorizontal: 8 },
  full: { flex: 1, backgroundColor: theme.bg, alignItems: "center", paddingHorizontal: 28 },
  close: { alignSelf: "flex-start" },
  closeTxt: { color: theme.muted, fontSize: 30 },
  art: { width: 260, height: 260, borderRadius: theme.radiusLg, backgroundColor: theme.card2, alignItems: "center", justifyContent: "center", overflow: "hidden", marginTop: 20, marginBottom: 28 },
  artNote: { color: theme.muted2, fontSize: 60 },
  fullT: { color: theme.text, fontSize: 22, fontWeight: "800", textAlign: "center" },
  fullA: { color: theme.muted, fontSize: 14, marginTop: 8 },
  progWrap: { width: "100%", marginTop: 30 },
  progBar: { height: 4, borderRadius: 2, backgroundColor: theme.card2, overflow: "hidden" },
  progFill: { height: 4, backgroundColor: theme.gold },
  times: { flexDirection: "row", justifyContent: "space-between", marginTop: 8 },
  time: { color: theme.muted2, fontSize: 11 },
  controls: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", width: "100%", marginTop: 36 },
  cBtn: { color: theme.muted, fontSize: 22 },
  cBig: { color: theme.text, fontSize: 30 },
  on: { color: theme.gold },
  playCircle: { width: 72, height: 72, borderRadius: 36, backgroundColor: theme.gold, alignItems: "center", justifyContent: "center" },
  playIcon: { color: "#ffffff", fontSize: 26, fontWeight: "800" },
});
