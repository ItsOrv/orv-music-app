import React, { useEffect, useState, useCallback } from "react";
import {
  View, Text, ScrollView, FlatList, TouchableOpacity, TextInput,
  ActivityIndicator, StyleSheet,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { theme } from "../theme";
import { discoverSearch, discoverForYou, discoverGenre, Track, sameTrack } from "../api";
import { usePlayer } from "../player";
import { TrackRow } from "../ui";
import { useTrackActions } from "../actions";

type Genre = { id: number; name: string; cover: string };
type SubView = { title: string; tracks: Track[] } | null;

export default function SearchScreen() {
  const insets = useSafeAreaInsets();
  const [q, setQ] = useState("");
  const [results, setResults] = useState<Track[] | null>(null);
  const [genres, setGenres] = useState<Genre[]>([]);
  const [sub, setSub] = useState<SubView>(null);
  const [loading, setLoading] = useState(false);
  const player = usePlayer();
  const { exploreRowMenu } = useTrackActions();

  const loadGenres = useCallback(async () => {
    try { const f = await discoverForYou(); setGenres(f.genres || []); } catch { setGenres([]); }
  }, []);

  useEffect(() => { loadGenres(); }, [loadGenres]);

  useEffect(() => {
    const query = q.trim();
    if (!query) { setResults(null); return; }
    const t = setTimeout(async () => {
      setLoading(true);
      try { setResults(await discoverSearch(query)); } catch { setResults([]); } finally { setLoading(false); }
    }, 350);
    return () => clearTimeout(t);
  }, [q]);

  const addBtn = (track: Track) => (
    <TouchableOpacity onPress={() => exploreRowMenu(track)} hitSlop={10}><Text style={styles.add}>＋</Text></TouchableOpacity>
  );

  const openGenre = async (id: number, name: string) => {
    setLoading(true);
    try { setSub({ title: name, tracks: await discoverGenre(id) }); } catch { setSub({ title: name, tracks: [] }); } finally { setLoading(false); }
  };

  const renderList = (list: Track[]) => (
    <FlatList
      data={list}
      keyExtractor={(t, i) => (t.ext_id || String(i))}
      renderItem={({ item, index }) => (
        <TrackRow track={item} active={sameTrack(player.current, item)} onPress={() => player.playQueue(list, index)} right={addBtn(item)} />
      )}
      contentContainerStyle={{ paddingBottom: 150 }}
    />
  );

  if (sub) {
    return (
      <View style={[styles.wrap, { paddingTop: insets.top + 8 }]}>
        <TouchableOpacity onPress={() => setSub(null)}><Text style={styles.back}>‹ {sub.title}</Text></TouchableOpacity>
        {loading ? <ActivityIndicator color={theme.gold} style={{ marginTop: 40 }} /> :
          sub.tracks.length ? renderList(sub.tracks) : <Text style={styles.empty}>چیزی نبود.</Text>}
      </View>
    );
  }

  return (
    <View style={[styles.wrap, { paddingTop: insets.top + 8 }]}>
      <Text style={styles.title}>جستجو</Text>
      <TextInput style={styles.search} placeholder="جستجوی آهنگ یا خواننده…" placeholderTextColor={theme.muted2} value={q} onChangeText={setQ} />

      {results !== null ? (
        loading ? (
          <ActivityIndicator color={theme.gold} style={{ marginTop: 40 }} />
        ) : results.length ? renderList(results) : <Text style={styles.empty}>چیزی پیدا نشد.</Text>
      ) : (
        <ScrollView contentContainerStyle={{ paddingBottom: 150 }} showsVerticalScrollIndicator={false}>
          {genres.length ? (
            <View style={styles.grid}>
              {genres.map((g, i) => (
                <TouchableOpacity key={g.id} style={[styles.tile, { backgroundColor: tileColor(i) }]} onPress={() => openGenre(g.id, g.name)}>
                  <Text numberOfLines={2} style={styles.tileTxt}>{g.name}</Text>
                </TouchableOpacity>
              ))}
            </View>
          ) : (
            <Text style={styles.empty}>دسته‌بندی‌ای پیدا نشد.</Text>
          )}
        </ScrollView>
      )}
    </View>
  );
}

const TILE_COLORS = ["#2a2018", "#242019", "#282218", "#221f1a", "#2c231a", "#231e18"];
const tileColor = (i: number) => TILE_COLORS[i % TILE_COLORS.length];

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: theme.bg, paddingHorizontal: 16 },
  title: { color: theme.text, fontSize: 20, fontWeight: "800", marginBottom: 12 },
  search: { backgroundColor: theme.card, borderRadius: theme.radius, borderWidth: 1, borderColor: theme.line, color: theme.text, paddingHorizontal: 14, height: 44, marginBottom: 6, textAlign: "right" },
  back: { color: theme.gold, fontSize: 15, fontWeight: "700", paddingVertical: 8, marginBottom: 4 },
  empty: { color: theme.muted, textAlign: "center", marginTop: 60, lineHeight: 24 },
  add: { color: theme.gold, fontSize: 24, fontWeight: "700", paddingHorizontal: 8 },
  grid: { flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between", paddingTop: 8, gap: 12 },
  tile: { width: "47%", height: 76, borderRadius: theme.radius, borderWidth: 1, borderColor: theme.line, padding: 14, justifyContent: "flex-end" },
  tileTxt: { color: theme.text, fontSize: 14, fontWeight: "700", textAlign: "right" },
});
