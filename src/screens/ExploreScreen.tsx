import React, { useEffect, useState, useCallback } from "react";
import {
  View, Text, ScrollView, FlatList, TouchableOpacity, TextInput, Image,
  ActivityIndicator, StyleSheet,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { theme } from "../theme";
import {
  discoverSearch, discoverForYou, discoverGenre, discoverAlbum, Track, ForYou, sameTrack,
} from "../api";
import { usePlayer } from "../player";
import { TrackRow, SectionHeader } from "../ui";
import { useTrackActions } from "../actions";

type SubView = { title: string; tracks: Track[] } | null;

export default function ExploreScreen() {
  const insets = useSafeAreaInsets();
  const [q, setQ] = useState("");
  const [results, setResults] = useState<Track[] | null>(null);
  const [foryou, setForYou] = useState<ForYou | null>(null);
  const [sub, setSub] = useState<SubView>(null);
  const [loading, setLoading] = useState(true);
  const player = usePlayer();
  const { exploreRowMenu } = useTrackActions();

  const loadForYou = useCallback(async () => {
    setLoading(true);
    try { setForYou(await discoverForYou()); } catch { setForYou(null); } finally { setLoading(false); }
  }, []);

  useEffect(() => { loadForYou(); }, [loadForYou]);

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
  const openAlbum = async (id: number, name: string) => {
    setLoading(true);
    try { setSub({ title: name, tracks: await discoverAlbum(id) }); } catch { setSub({ title: name, tracks: [] }); } finally { setLoading(false); }
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

  // subview: a genre or album track list
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
      <Text style={styles.title}>اکسپلور</Text>
      <TextInput style={styles.search} placeholder="جستجوی آهنگ یا خواننده…" placeholderTextColor={theme.muted2} value={q} onChangeText={setQ} />

      {loading && !foryou && !results ? (
        <ActivityIndicator color={theme.gold} style={{ marginTop: 40 }} />
      ) : results !== null ? (
        results.length ? renderList(results) : <Text style={styles.empty}>چیزی پیدا نشد.</Text>
      ) : foryou ? (
        <ScrollView contentContainerStyle={{ paddingBottom: 150 }} showsVerticalScrollIndicator={false}>
          {!!foryou.genres?.length && (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
              {foryou.genres.map((g) => (
                <TouchableOpacity key={g.id} style={styles.chip} onPress={() => openGenre(g.id, g.name)}>
                  <Text style={styles.chipTxt}>{g.name}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          )}

          {!!foryou.chart?.length && (
            <>
              <SectionHeader>داغِ الان</SectionHeader>
              {foryou.chart.map((t, i) => (
                <TrackRow key={t.ext_id || i} track={t} active={sameTrack(player.current, t)} onPress={() => player.playQueue(foryou.chart, i)} right={addBtn(t)} />
              ))}
            </>
          )}

          {!!foryou.new_releases?.length && (
            <>
              <SectionHeader>تازه‌ها</SectionHeader>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.albums}>
                {foryou.new_releases.map((a) => (
                  <TouchableOpacity key={a.album_id} style={styles.album} onPress={() => openAlbum(a.album_id, a.title)}>
                    <View style={styles.albumCover}>
                      {a.cover ? <Image source={{ uri: a.cover }} style={styles.img} /> : <Text style={styles.albumNote}>♪</Text>}
                    </View>
                    <Text numberOfLines={1} style={styles.albumT}>{a.title}</Text>
                    <Text numberOfLines={1} style={styles.albumA}>{a.artist}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </>
          )}
        </ScrollView>
      ) : (
        <Text style={styles.empty}>اکسپلور در دسترس نیست. بعداً امتحان کن.</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: theme.bg, paddingHorizontal: 16 },
  title: { color: theme.text, fontSize: 20, fontWeight: "800", marginBottom: 12 },
  search: { backgroundColor: theme.card, borderRadius: theme.radius, borderWidth: 1, borderColor: theme.line, color: theme.text, paddingHorizontal: 14, height: 44, marginBottom: 6, textAlign: "right" },
  back: { color: theme.gold, fontSize: 15, fontWeight: "700", paddingVertical: 8, marginBottom: 4 },
  empty: { color: theme.muted, textAlign: "center", marginTop: 60, lineHeight: 24 },
  add: { color: theme.gold, fontSize: 24, fontWeight: "700", paddingHorizontal: 8 },
  chips: { gap: 8, paddingVertical: 8 },
  chip: { borderWidth: 1, borderColor: theme.line, borderRadius: 999, paddingHorizontal: 15, paddingVertical: 8 },
  chipTxt: { color: theme.muted, fontSize: 12.5, fontWeight: "600" },
  albums: { gap: 12, paddingVertical: 6 },
  album: { width: 140 },
  albumCover: { width: 140, height: 140, borderRadius: theme.radius, backgroundColor: theme.card2, alignItems: "center", justifyContent: "center", overflow: "hidden" },
  albumNote: { color: theme.muted2, fontSize: 34 },
  albumT: { color: theme.text, fontSize: 13, fontWeight: "600", marginTop: 8, textAlign: "right" },
  albumA: { color: theme.muted, fontSize: 11.5, marginTop: 3, textAlign: "right" },
  img: { width: "100%", height: "100%" },
});
