import React, { useEffect, useState, useCallback } from "react";
import {
  View, Text, FlatList, TouchableOpacity, Image, TextInput,
  ActivityIndicator, StyleSheet, RefreshControl, Modal,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { theme } from "../theme";
import { api, coverUrl, Track, Me } from "../api";
import { usePlayer } from "../player";

const fmt = (ms: number) => {
  const s = Math.floor((ms || 0) / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
};

export default function LibraryScreen({ navigation, me }: any) {
  const insets = useSafeAreaInsets();
  const [tracks, setTracks] = useState<Track[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [full, setFull] = useState(false);
  const player = usePlayer();

  const load = useCallback(async (query = "") => {
    setLoading(true);
    try {
      setTracks(await api<Track[]>(`tracks${query ? `?q=${encodeURIComponent(query)}` : ""}`));
    } catch {
      setTracks([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    const t = setTimeout(() => load(q.trim()), 350);
    return () => clearTimeout(t);
  }, [q]);

  const renderRow = ({ item, index }: { item: Track; index: number }) => {
    const active = player.current?.id === item.id;
    const cover = coverUrl(item);
    return (
      <TouchableOpacity style={styles.row} onPress={() => player.playQueue(tracks, index)} activeOpacity={0.7}>
        <View style={styles.cover}>
          {cover ? <Image source={{ uri: cover }} style={styles.coverImg} /> : <Text style={styles.note}>♪</Text>}
        </View>
        <View style={{ flex: 1 }}>
          <Text numberOfLines={1} style={[styles.t, active && { color: theme.gold }]}>{item.title || "بی‌نام"}</Text>
          {!!item.artist && <Text numberOfLines={1} style={styles.a}>{item.artist}</Text>}
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={[styles.wrap, { paddingTop: insets.top + 8 }]}>
      <View style={styles.header}>
        <Text style={styles.title}>کتابخونه‌ی من</Text>
        <TouchableOpacity onPress={() => navigation.navigate("Settings")}><Text style={styles.gear}>⚙</Text></TouchableOpacity>
      </View>
      <TextInput
        style={styles.search}
        placeholder="جستجو…"
        placeholderTextColor={theme.muted2}
        value={q}
        onChangeText={setQ}
      />

      {loading ? (
        <ActivityIndicator color={theme.gold} style={{ marginTop: 40 }} />
      ) : tracks.length === 0 ? (
        <Text style={styles.empty}>هنوز آهنگی نیست.{"\n"}تو رباتِ @OrvMusicBot آهنگاتو forward کن.</Text>
      ) : (
        <FlatList
          data={tracks}
          keyExtractor={(t) => String(t.id)}
          renderItem={renderRow}
          contentContainerStyle={{ paddingBottom: player.current ? 90 : 24 }}
          refreshControl={<RefreshControl refreshing={false} onRefresh={() => load(q.trim())} tintColor={theme.gold} />}
        />
      )}

      {player.current && <MiniPlayer onOpen={() => setFull(true)} />}
      <Modal visible={full} animationType="slide" onRequestClose={() => setFull(false)}>
        <FullPlayer onClose={() => setFull(false)} />
      </Modal>
    </View>
  );
}

function MiniPlayer({ onOpen }: { onOpen: () => void }) {
  const p = usePlayer();
  const cover = p.current ? coverUrl(p.current) : null;
  return (
    <TouchableOpacity style={styles.mini} onPress={onOpen} activeOpacity={0.9}>
      <View style={styles.miniCover}>
        {cover ? <Image source={{ uri: cover }} style={styles.coverImg} /> : <Text style={styles.note}>♪</Text>}
      </View>
      <View style={{ flex: 1 }}>
        <Text numberOfLines={1} style={styles.miniT}>{p.current?.title || "—"}</Text>
        {!!p.current?.artist && <Text numberOfLines={1} style={styles.a}>{p.current.artist}</Text>}
      </View>
      <TouchableOpacity onPress={p.toggle} hitSlop={12}><Text style={styles.miniBtn}>{p.isPlaying ? "❚❚" : "▶"}</Text></TouchableOpacity>
      <TouchableOpacity onPress={p.next} hitSlop={12}><Text style={styles.miniBtn}>⏭</Text></TouchableOpacity>
    </TouchableOpacity>
  );
}

function FullPlayer({ onClose }: { onClose: () => void }) {
  const p = usePlayer();
  const insets = useSafeAreaInsets();
  const cover = p.current ? coverUrl(p.current) : null;
  const pct = p.duration ? Math.min(1, p.position / p.duration) : 0;
  return (
    <View style={[styles.full, { paddingTop: insets.top + 10, paddingBottom: insets.bottom + 24 }]}>
      <TouchableOpacity onPress={onClose} style={styles.fullClose}><Text style={styles.gear}>⌄</Text></TouchableOpacity>
      <View style={styles.fullArt}>
        {cover ? <Image source={{ uri: cover }} style={styles.coverImg} /> : <Text style={styles.artNote}>♪</Text>}
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
  wrap: { flex: 1, backgroundColor: theme.bg, paddingHorizontal: 16 },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 12 },
  title: { color: theme.text, fontSize: 20, fontWeight: "800" },
  gear: { color: theme.muted, fontSize: 22 },
  search: { backgroundColor: theme.card, borderRadius: theme.radius, borderWidth: 1, borderColor: theme.line, color: theme.text, paddingHorizontal: 14, height: 44, marginBottom: 8, textAlign: "right" },
  empty: { color: theme.muted, textAlign: "center", marginTop: 60, lineHeight: 24 },
  row: { flexDirection: "row", alignItems: "center", paddingVertical: 8, gap: 12 },
  cover: { width: 48, height: 48, borderRadius: theme.radiusSm, backgroundColor: theme.card2, alignItems: "center", justifyContent: "center", overflow: "hidden" },
  coverImg: { width: "100%", height: "100%" },
  note: { color: theme.muted2, fontSize: 18 },
  t: { color: theme.text, fontSize: 15, fontWeight: "600", textAlign: "right" },
  a: { color: theme.muted, fontSize: 12.5, marginTop: 3, textAlign: "right" },
  mini: { position: "absolute", left: 12, right: 12, bottom: 14, height: 62, backgroundColor: theme.card, borderRadius: theme.radius, borderWidth: 1, borderColor: theme.line, flexDirection: "row", alignItems: "center", paddingHorizontal: 10, gap: 10 },
  miniCover: { width: 42, height: 42, borderRadius: 8, backgroundColor: theme.card2, alignItems: "center", justifyContent: "center", overflow: "hidden" },
  miniT: { color: theme.text, fontSize: 13.5, fontWeight: "600", textAlign: "right" },
  miniBtn: { color: theme.text, fontSize: 18, paddingHorizontal: 8 },
  full: { flex: 1, backgroundColor: theme.bg, alignItems: "center", paddingHorizontal: 28 },
  fullClose: { alignSelf: "flex-start" },
  fullArt: { width: 260, height: 260, borderRadius: theme.radiusLg, backgroundColor: theme.card2, alignItems: "center", justifyContent: "center", overflow: "hidden", marginTop: 20, marginBottom: 28 },
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
  playIcon: { color: "#17130c", fontSize: 26, fontWeight: "800" },
});
