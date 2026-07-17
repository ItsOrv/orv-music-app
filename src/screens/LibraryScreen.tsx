import React, { useEffect, useState, useCallback } from "react";
import { View, Text, FlatList, TouchableOpacity, TextInput, ActivityIndicator, StyleSheet, RefreshControl } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { theme } from "../theme";
import { getTracks, discoverForYou, Track, trackKey, sameTrack } from "../api";
import { usePlayer } from "../player";
import { TrackRow, SectionHeader } from "../ui";
import { useTrackActions } from "../actions";

const FORYOU_COLLAPSED = 4;

export default function LibraryScreen({ navigation }: any) {
  const insets = useSafeAreaInsets();
  const [tracks, setTracks] = useState<Track[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [foryou, setForYou] = useState<Track[]>([]);
  const [expanded, setExpanded] = useState(false);
  const player = usePlayer();
  const { libraryRowMenu, exploreRowMenu } = useTrackActions();

  const load = useCallback(async (query = "") => {
    setLoading(true);
    try { setTracks(await getTracks(query)); } catch { setTracks([]); } finally { setLoading(false); }
  }, []);

  // best-effort personalized picks; flatten for_you shelves into one deduped pool
  const loadForYou = useCallback(async () => {
    try {
      const f = await discoverForYou();
      const seen = new Set<string>();
      const pool: Track[] = [];
      for (const shelf of f.for_you || []) {
        for (const t of shelf.tracks || []) {
          const k = trackKey(t);
          if (seen.has(k)) continue;
          seen.add(k);
          pool.push(t);
        }
      }
      setForYou(pool);
    } catch { setForYou([]); }
  }, []);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { loadForYou(); }, [loadForYou]);
  useEffect(() => { const t = setTimeout(() => load(q.trim()), 350); return () => clearTimeout(t); }, [q]);

  const shown = expanded ? foryou : foryou.slice(0, FORYOU_COLLAPSED);

  const recHeader = () => {
    if (q.trim() || !foryou.length) return null;
    return (
      <View>
        <View style={styles.recHead}>
          <SectionHeader>پیشنهاد برای تو</SectionHeader>
          <TouchableOpacity onPress={loadForYou} hitSlop={10}><Text style={styles.refresh}>↻</Text></TouchableOpacity>
        </View>
        {shown.map((t, i) => (
          <TrackRow
            key={trackKey(t)}
            track={t}
            active={sameTrack(player.current, t)}
            onPress={() => player.playQueue(foryou, i)}
            right={<TouchableOpacity onPress={() => exploreRowMenu(t)} hitSlop={10}><Text style={styles.add}>＋</Text></TouchableOpacity>}
          />
        ))}
        {foryou.length > FORYOU_COLLAPSED && (
          <TouchableOpacity onPress={() => setExpanded((v) => !v)} hitSlop={8}>
            <Text style={styles.toggle}>{expanded ? "نمایش کمتر ▲" : "نمایش بیشتر ▼"}</Text>
          </TouchableOpacity>
        )}
        <SectionHeader>آهنگ‌های من</SectionHeader>
      </View>
    );
  };

  return (
    <View style={[styles.wrap, { paddingTop: insets.top + 8 }]}>
      <View style={styles.header}>
        <Text style={styles.title}>کتابخونه‌ی من</Text>
        <TouchableOpacity onPress={() => navigation.navigate("Settings")}><Text style={styles.gear}>⚙</Text></TouchableOpacity>
      </View>
      <TextInput style={styles.search} placeholder="جستجو…" placeholderTextColor={theme.muted2} value={q} onChangeText={setQ} />

      {loading ? (
        <ActivityIndicator color={theme.gold} style={{ marginTop: 40 }} />
      ) : tracks.length === 0 && !foryou.length ? (
        <Text style={styles.empty}>هنوز آهنگی نیست.{"\n"}تو رباتِ @OrvMusicBot آهنگاتو forward کن، یا از تبِ «اکسپلور» اضافه کن.</Text>
      ) : (
        <FlatList
          data={tracks}
          keyExtractor={(t) => String(t.id)}
          ListHeaderComponent={recHeader}
          ListEmptyComponent={<Text style={styles.emptyList}>هنوز آهنگی تو کتابخونه نیست.</Text>}
          renderItem={({ item, index }) => (
            <TrackRow
              track={item}
              active={sameTrack(player.current, item)}
              onPress={() => player.playQueue(tracks, index)}
              right={<TouchableOpacity onPress={() => libraryRowMenu(item, () => load(q.trim()))} hitSlop={10}><Text style={styles.menu}>⋯</Text></TouchableOpacity>}
            />
          )}
          contentContainerStyle={{ paddingBottom: 150 }}
          refreshControl={<RefreshControl refreshing={false} onRefresh={() => { load(q.trim()); loadForYou(); }} tintColor={theme.gold} />}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: theme.bg, paddingHorizontal: 16 },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 12 },
  title: { color: theme.text, fontSize: 20, fontWeight: "800" },
  gear: { color: theme.muted, fontSize: 22 },
  search: { backgroundColor: theme.card, borderRadius: theme.radius, borderWidth: 1, borderColor: theme.line, color: theme.text, paddingHorizontal: 14, height: 44, marginBottom: 4, textAlign: "right" },
  empty: { color: theme.muted, textAlign: "center", marginTop: 60, lineHeight: 24 },
  emptyList: { color: theme.muted, textAlign: "center", marginTop: 20, lineHeight: 24 },
  menu: { color: theme.muted, fontSize: 22, paddingHorizontal: 8 },
  add: { color: theme.gold, fontSize: 24, fontWeight: "700", paddingHorizontal: 8 },
  recHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  refresh: { color: theme.gold, fontSize: 18, fontWeight: "700", paddingHorizontal: 8, paddingTop: 16 },
  toggle: { color: theme.gold, fontSize: 13, fontWeight: "700", textAlign: "center", paddingVertical: 10 },
});
