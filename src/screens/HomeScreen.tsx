import React, { useEffect, useState, useCallback } from "react";
import {
  View, Text, ScrollView, TouchableOpacity, ActivityIndicator, StyleSheet, RefreshControl,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { theme } from "../theme";
import {
  discoverForYou, getHistory, discoverAlbum, coverUrl,
  Track, ForYou, trackKey, sameTrack,
} from "../api";
import { usePlayer } from "../player";
import { CoverCard, Rail, SectionHeader, TrackRow } from "../ui";

type SubView = { title: string; tracks: Track[] } | null;

export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const [foryou, setForYou] = useState<ForYou | null>(null);
  const [history, setHistory] = useState<Track[]>([]);
  const [sub, setSub] = useState<SubView>(null);
  const [loading, setLoading] = useState(true);
  const player = usePlayer();

  const load = useCallback(async () => {
    setLoading(true);
    try { setForYou(await discoverForYou()); } catch { setForYou(null); }
    try { setHistory(await getHistory(12)); } catch { setHistory([]); }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const openAlbum = async (id: number, name: string) => {
    setLoading(true);
    try { setSub({ title: name, tracks: await discoverAlbum(id) }); } catch { setSub({ title: name, tracks: [] }); } finally { setLoading(false); }
  };

  const playMix = () => {
    const seen = new Set<string>();
    const pool: Track[] = [];
    for (const s of foryou?.for_you || []) {
      for (const t of s.tracks || []) {
        const k = trackKey(t);
        if (seen.has(k)) continue;
        seen.add(k);
        pool.push(t);
      }
    }
    const source = pool.length ? pool : foryou?.chart || [];
    if (!source.length) return;
    const arr = source.slice();
    for (let i = arr.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [arr[i], arr[j]] = [arr[j], arr[i]]; }
    if (!player.shuffle) player.toggleShuffle();
    player.playQueue(arr, 0);
  };

  if (sub) {
    return (
      <View style={[styles.wrap, { paddingTop: insets.top + 8 }]}>
        <TouchableOpacity onPress={() => setSub(null)}><Text style={styles.back}>‹ {sub.title}</Text></TouchableOpacity>
        {loading ? <ActivityIndicator color={theme.gold} style={{ marginTop: 40 }} /> :
          sub.tracks.length ? (
            <ScrollView contentContainerStyle={{ paddingBottom: 150 }} showsVerticalScrollIndicator={false}>
              {sub.tracks.map((t, i) => (
                <TrackRow key={t.ext_id || i} track={t} active={sameTrack(player.current, t)} onPress={() => player.playQueue(sub.tracks, i)} />
              ))}
            </ScrollView>
          ) : <Text style={styles.empty}>Nothing here.</Text>}
      </View>
    );
  }

  const mixes = (foryou?.for_you || []).filter((s) => (s.tracks || []).length);

  return (
    <View style={[styles.wrap, { paddingTop: insets.top + 8 }]}>
      <Text style={styles.title}>Home</Text>
      {loading && !foryou && !history.length ? (
        <ActivityIndicator color={theme.gold} style={{ marginTop: 40 }} />
      ) : !foryou && !history.length ? (
        <Text style={styles.empty}>Source unavailable, try again.</Text>
      ) : (
        <ScrollView
          contentContainerStyle={{ paddingBottom: 150 }}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={false} onRefresh={load} tintColor={theme.gold} />}
        >
          <View style={styles.hero}>
            <Text style={styles.heroEyebrow}>MADE FOR YOU</Text>
            <Text style={styles.heroTitle}>Your daily mix</Text>
            <Text style={styles.heroSub}>A fresh set picked from what you love</Text>
            <TouchableOpacity style={styles.heroCta} onPress={playMix} activeOpacity={0.85}>
              <Text style={styles.heroCtaTxt}>▶ Play mix</Text>
            </TouchableOpacity>
          </View>

          {!!history.length && (
            <>
              <SectionHeader>Recently played</SectionHeader>
              <Rail>
                {history.map((t, i) => (
                  <CoverCard key={trackKey(t) + i} uri={coverUrl(t)} title={t.title || "Untitled"} subtitle={t.artist || ""} active={sameTrack(player.current, t)} onPress={() => player.playQueue(history, i)} />
                ))}
              </Rail>
            </>
          )}

          {!!mixes.length && (
            <>
              <SectionHeader>Your mixes</SectionHeader>
              <Rail>
                {mixes.map((s, i) => (
                  <CoverCard key={i} uri={s.tracks[0] ? coverUrl(s.tracks[0]) : null} tag={s.title} title={s.title} subtitle={`Mix · ${s.tracks.length} songs`} onPress={() => player.playQueue(s.tracks, 0)} />
                ))}
              </Rail>
            </>
          )}

          {!!foryou?.chart?.length && (
            <>
              <SectionHeader>More of what you like</SectionHeader>
              <Rail>
                {foryou.chart.map((t, i) => (
                  <CoverCard key={trackKey(t) + i} uri={coverUrl(t)} title={t.title || "Untitled"} subtitle={t.artist || ""} active={sameTrack(player.current, t)} onPress={() => player.playQueue(foryou.chart, i)} />
                ))}
              </Rail>
            </>
          )}

          {!!foryou?.new_releases?.length && (
            <>
              <SectionHeader>New releases</SectionHeader>
              <Rail>
                {foryou.new_releases.map((a) => (
                  <CoverCard key={a.album_id} uri={a.cover || null} title={a.title} subtitle={a.artist} onPress={() => openAlbum(a.album_id, a.title)} />
                ))}
              </Rail>
            </>
          )}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: theme.bg, paddingHorizontal: 16 },
  title: { color: theme.text, fontSize: 20, fontWeight: "800", marginBottom: 12 },
  back: { color: theme.gold, fontSize: 15, fontWeight: "700", paddingVertical: 8, marginBottom: 4 },
  empty: { color: theme.muted, textAlign: "center", marginTop: 60, lineHeight: 24 },
  hero: { backgroundColor: theme.gold2, borderRadius: theme.radiusLg, padding: 20, marginTop: 4, overflow: "hidden" },
  heroEyebrow: { color: "rgba(255,255,255,0.75)", fontSize: 11, fontWeight: "800", letterSpacing: 1.5 },
  heroTitle: { color: "#ffffff", fontSize: 26, fontWeight: "900", marginTop: 8 },
  heroSub: { color: "rgba(255,255,255,0.85)", fontSize: 13.5, marginTop: 6 },
  heroCta: { backgroundColor: "#ffffff", borderRadius: 999, paddingVertical: 11, paddingHorizontal: 22, alignSelf: "flex-start", marginTop: 16 },
  heroCtaTxt: { color: theme.gold2, fontWeight: "800", fontSize: 14 },
});
