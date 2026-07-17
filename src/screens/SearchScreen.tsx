import React, { useEffect, useState, useCallback } from "react";
import {
  View, Text, ScrollView, FlatList, TouchableOpacity, TextInput, Image,
  ActivityIndicator, StyleSheet,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { theme } from "../theme";
import { discoverSearch, discoverForYou, discoverGenre, Genre, Track, sameTrack } from "../api";
import { usePlayer } from "../player";
import { TrackRow, SectionHeader } from "../ui";
import { useTrackActions } from "../actions";

type SubView = { title: string; tracks: Track[] } | null;
type Card = { name: string; cover?: string; genre?: number; q?: string };

const MOODS: { n: string; q: string }[] = [
  { n: "Party", q: "party hits" }, { n: "Chill", q: "chill" }, { n: "Workout", q: "workout" },
  { n: "Focus", q: "focus instrumental" }, { n: "Feel Good", q: "feel good" }, { n: "Love", q: "love songs" },
  { n: "Sad", q: "sad songs" }, { n: "Sleep", q: "sleep" }, { n: "Throwback", q: "throwback hits" },
  { n: "Road Trip", q: "road trip" }, { n: "Late Night", q: "late night vibes" }, { n: "Summer", q: "summer hits" },
];

const CAT_COLORS = [
  "#8e44ad", "#16a085", "#e67e22", "#2980b9", "#d35400", "#27ae60", "#c0392b",
  "#2c3e50", "#e84393", "#0984e3", "#e17055", "#00b894", "#6c5ce7", "#fdcb6e",
];

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

  const openCard = async (c: Card) => {
    setLoading(true);
    try {
      const tracks = c.genre != null ? await discoverGenre(c.genre) : await discoverSearch(c.q || c.name);
      setSub({ title: c.name, tracks });
    } catch { setSub({ title: c.name, tracks: [] }); } finally { setLoading(false); }
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
          sub.tracks.length ? renderList(sub.tracks) : <Text style={styles.empty}>Nothing here.</Text>}
      </View>
    );
  }

  const cards: Card[] = [
    ...genres.map((g) => ({ name: g.name, cover: g.cover, genre: g.id })),
    ...MOODS.map((m) => ({ name: m.n, q: m.q })),
  ];
  const left = cards.filter((_, i) => i % 2 === 0);
  const right = cards.filter((_, i) => i % 2 === 1);

  const tile = (c: Card, i: number) => {
    const tall = i % 3 === 0;
    return (
      <TouchableOpacity key={c.name + i} style={[styles.vibe, { height: tall ? 150 : 108, backgroundColor: CAT_COLORS[(cards.indexOf(c)) % CAT_COLORS.length] }]} onPress={() => openCard(c)} activeOpacity={0.8}>
        {!!c.cover && <Image source={{ uri: c.cover }} style={styles.vibeArt} />}
        <View style={styles.vibeOverlay} />
        <Text numberOfLines={2} style={styles.vibeTxt}>{c.name}</Text>
      </TouchableOpacity>
    );
  };

  return (
    <View style={[styles.wrap, { paddingTop: insets.top + 8 }]}>
      <Text style={styles.title}>Search</Text>
      <TextInput style={styles.search} placeholder="Search songs or artists…" placeholderTextColor={theme.muted2} value={q} onChangeText={setQ} />

      {results !== null ? (
        loading ? (
          <ActivityIndicator color={theme.gold} style={{ marginTop: 40 }} />
        ) : results.length ? renderList(results) : <Text style={styles.empty}>No results found.</Text>
      ) : (
        <ScrollView contentContainerStyle={{ paddingBottom: 150 }} showsVerticalScrollIndicator={false}>
          {cards.length ? (
            <>
              <SectionHeader>Vibes</SectionHeader>
              <View style={styles.grid}>
                <View style={styles.col}>{left.map((c, i) => tile(c, i))}</View>
                <View style={styles.col}>{right.map((c, i) => tile(c, i))}</View>
              </View>
            </>
          ) : (
            <Text style={styles.empty}>Source unavailable, try again.</Text>
          )}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: theme.bg, paddingHorizontal: 16 },
  title: { color: theme.text, fontSize: 20, fontWeight: "800", marginBottom: 12 },
  search: { backgroundColor: theme.card, borderRadius: theme.radius, borderWidth: 1, borderColor: theme.line, color: theme.text, paddingHorizontal: 14, height: 44, marginBottom: 6, textAlign: "left" },
  back: { color: theme.gold, fontSize: 15, fontWeight: "700", paddingVertical: 8, marginBottom: 4 },
  empty: { color: theme.muted, textAlign: "center", marginTop: 60, lineHeight: 24 },
  add: { color: theme.gold, fontSize: 24, fontWeight: "700", paddingHorizontal: 8 },
  grid: { flexDirection: "row", gap: 12 },
  col: { flex: 1, gap: 12 },
  vibe: { borderRadius: theme.radius, padding: 14, justifyContent: "flex-start", overflow: "hidden" },
  vibeArt: { ...StyleSheet.absoluteFillObject, width: "100%", height: "100%", opacity: 0.55 },
  vibeOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(0,0,0,0.28)" },
  vibeTxt: { color: "#ffffff", fontSize: 15, fontWeight: "800", textAlign: "left", textShadowColor: "rgba(0,0,0,0.5)", textShadowRadius: 5 },
});
