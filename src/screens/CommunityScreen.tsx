import React, { useEffect, useState, useCallback } from "react";
import { View, Text, FlatList, TouchableOpacity, TextInput, ActivityIndicator, StyleSheet } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { theme } from "../theme";
import { communityTracks, Track, sameTrack } from "../api";
import { usePlayer } from "../player";
import { TrackRow, iconBtn } from "../ui";
import { useTrackActions } from "../actions";

export default function CommunityScreen() {
  const insets = useSafeAreaInsets();
  const [tracks, setTracks] = useState<Track[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const player = usePlayer();
  const { saveCommunity } = useTrackActions();

  const load = useCallback(async (query = "") => {
    setLoading(true);
    try {
      const list = (await communityTracks(query)).map((t) => ({ ...t, community: true as const }));
      setTracks(list);
    } catch { setTracks([]); } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { const t = setTimeout(() => load(q.trim()), 350); return () => clearTimeout(t); }, [q]);

  return (
    <View style={[styles.wrap, { paddingTop: insets.top + 8 }]}>
      <Text style={styles.title}>Community</Text>
      <TextInput style={styles.search} placeholder="Search everyone's tracks…" placeholderTextColor={theme.muted2} value={q} onChangeText={setQ} />

      {loading ? (
        <ActivityIndicator color={theme.gold} style={{ marginTop: 40 }} />
      ) : tracks.length === 0 ? (
        <Text style={styles.empty}>Nothing here yet. Tracks that users send to the bot are shared here for everyone.</Text>
      ) : (
        <FlatList
          data={tracks}
          keyExtractor={(t, i) => "c" + (t.id ?? i)}
          renderItem={({ item, index }) => (
            <TrackRow
              track={item}
              active={sameTrack(player.current, item)}
              onPress={() => player.playQueue(tracks, index)}
              right={
                <View style={styles.right}>
                  {!!item.plays && <Text style={iconBtn.plays}>▶ {item.plays}</Text>}
                  <TouchableOpacity onPress={() => saveCommunity(item)} hitSlop={10}><Text style={styles.add}>＋</Text></TouchableOpacity>
                </View>
              }
            />
          )}
          contentContainerStyle={{ paddingBottom: 150 }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: theme.bg, paddingHorizontal: 16 },
  title: { color: theme.text, fontSize: 20, fontWeight: "800", marginBottom: 12 },
  search: { backgroundColor: theme.card, borderRadius: theme.radius, borderWidth: 1, borderColor: theme.line, color: theme.text, paddingHorizontal: 14, height: 44, marginBottom: 4, textAlign: "left" },
  empty: { color: theme.muted, textAlign: "center", marginTop: 60, lineHeight: 24 },
  right: { flexDirection: "row", alignItems: "center", gap: 6 },
  add: { color: theme.gold, fontSize: 24, fontWeight: "700", paddingHorizontal: 6 },
});
