import React, { useEffect, useState, useCallback } from "react";
import {
  View, Text, FlatList, TouchableOpacity, TextInput, ScrollView,
  ActivityIndicator, StyleSheet, RefreshControl,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { theme } from "../theme";
import { getMe, getTracks, getHistory, getLiked, coverUrl, Me, Track, trackKey, sameTrack } from "../api";
import { usePlayer } from "../player";
import { TrackRow, CoverCard, Rail, SectionHeader } from "../ui";
import { useTrackActions } from "../actions";
import PlaylistsScreen from "./PlaylistsScreen";

type Section = "menu" | "songs" | "liked" | "playlists";

export default function LibraryScreen({ navigation }: any) {
  const insets = useSafeAreaInsets();
  const [section, setSection] = useState<Section>("menu");
  const [me, setMe] = useState<Me | null>(null);
  const [history, setHistory] = useState<Track[]>([]);
  const [likedCount, setLikedCount] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const player = usePlayer();

  const loadMenu = useCallback(async () => {
    setLoading(true);
    try { setMe(await getMe()); } catch { setMe(null); }
    try { setHistory(await getHistory(12)); } catch { setHistory([]); }
    try { setLikedCount((await getLiked()).length); } catch { setLikedCount(null); }
    setLoading(false);
  }, []);

  useEffect(() => { loadMenu(); }, [loadMenu]);

  if (section === "songs") return <SongsSubScreen onBack={() => setSection("menu")} />;
  if (section === "liked") return <LikedSubScreen onBack={() => setSection("menu")} />;
  if (section === "playlists") {
    return (
      <View style={[styles.wrap, { paddingTop: insets.top + 8 }]}>
        <TouchableOpacity onPress={() => setSection("menu")}><Text style={styles.back}>‹ Library</Text></TouchableOpacity>
        <PlaylistsScreen />
      </View>
    );
  }

  const name = me?.first_name || me?.username || "Your Library";
  const initial = (name || "U").trim().charAt(0).toUpperCase() || "U";
  const nsongs = me?.tracks || 0;

  return (
    <View style={[styles.wrap, { paddingTop: insets.top + 8 }]}>
      {loading ? (
        <ActivityIndicator color={theme.gold} style={{ marginTop: 60 }} />
      ) : (
        <ScrollView
          contentContainerStyle={{ paddingBottom: 150 }}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={false} onRefresh={loadMenu} tintColor={theme.gold} />}
        >
          <View style={styles.libHdr}>
            <View style={styles.avatar}><Text style={styles.avatarTxt}>{initial}</Text></View>
            <View style={{ flex: 1 }}>
              <Text numberOfLines={1} style={styles.lhName}>{name}</Text>
              <Text style={styles.lhSub}>{nsongs} songs{me?.username ? ` · @${me.username}` : ""}</Text>
            </View>
            <TouchableOpacity onPress={() => navigation.navigate("Settings")} hitSlop={10}><Text style={styles.gear}>⚙</Text></TouchableOpacity>
          </View>

          <View style={styles.menu}>
            <LibItem icon="♥" label="Liked tracks" count={likedCount ?? ""} onPress={() => setSection("liked")} />
            <LibItem icon="♪" label="Songs" count={nsongs || ""} onPress={() => setSection("songs")} />
            <LibItem icon="≣" label="Playlists" count="" onPress={() => setSection("playlists")} />
            <LibItem icon="↓" label="Downloads" count="" onPress={() => navigation.navigate("Settings")} />
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
        </ScrollView>
      )}
    </View>
  );
}

function LibItem({ icon, label, count, onPress }: { icon: string; label: string; count: number | string; onPress: () => void }) {
  return (
    <TouchableOpacity style={styles.item} onPress={onPress} activeOpacity={0.7}>
      <Text style={styles.itemIc}>{icon}</Text>
      <Text style={styles.itemT}>{label}</Text>
      {count !== "" && <Text style={styles.itemCount}>{count}</Text>}
      <Text style={styles.itemChev}>›</Text>
    </TouchableOpacity>
  );
}

function SongsSubScreen({ onBack }: { onBack: () => void }) {
  const insets = useSafeAreaInsets();
  const [tracks, setTracks] = useState<Track[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const player = usePlayer();
  const { libraryRowMenu } = useTrackActions();

  const load = useCallback(async (query = "") => {
    setLoading(true);
    try { setTracks(await getTracks(query)); } catch { setTracks([]); } finally { setLoading(false); }
  }, []);

  useEffect(() => { const t = setTimeout(() => load(q.trim()), 350); return () => clearTimeout(t); }, [q, load]);

  return (
    <View style={[styles.wrap, { paddingTop: insets.top + 8 }]}>
      <TouchableOpacity onPress={onBack}><Text style={styles.back}>‹ Songs</Text></TouchableOpacity>
      <TextInput style={styles.search} placeholder="Search your library…" placeholderTextColor={theme.muted2} value={q} onChangeText={setQ} />
      {loading ? (
        <ActivityIndicator color={theme.gold} style={{ marginTop: 40 }} />
      ) : tracks.length === 0 ? (
        <Text style={styles.empty}>{q.trim() ? "Nothing found." : "No songs yet.\nForward your songs to @OrvMusicBot, or add some from the Search tab."}</Text>
      ) : (
        <FlatList
          data={tracks}
          keyExtractor={(t) => String(t.id)}
          renderItem={({ item, index }) => (
            <TrackRow
              track={item}
              active={sameTrack(player.current, item)}
              onPress={() => player.playQueue(tracks, index)}
              right={<TouchableOpacity onPress={() => libraryRowMenu(item, () => load(q.trim()))} hitSlop={10}><Text style={styles.menuDots}>⋯</Text></TouchableOpacity>}
            />
          )}
          contentContainerStyle={{ paddingBottom: 150 }}
          refreshControl={<RefreshControl refreshing={false} onRefresh={() => load(q.trim())} tintColor={theme.gold} />}
        />
      )}
    </View>
  );
}

function LikedSubScreen({ onBack }: { onBack: () => void }) {
  const insets = useSafeAreaInsets();
  const [tracks, setTracks] = useState<Track[]>([]);
  const [loading, setLoading] = useState(true);
  const player = usePlayer();
  const { libraryRowMenu } = useTrackActions();

  const load = useCallback(async () => {
    setLoading(true);
    try { setTracks(await getLiked()); } catch { setTracks([]); } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  return (
    <View style={[styles.wrap, { paddingTop: insets.top + 8 }]}>
      <TouchableOpacity onPress={onBack}><Text style={styles.back}>‹ Liked tracks</Text></TouchableOpacity>
      {loading ? (
        <ActivityIndicator color={theme.gold} style={{ marginTop: 40 }} />
      ) : tracks.length === 0 ? (
        <Text style={styles.empty}>No liked tracks yet.</Text>
      ) : (
        <FlatList
          data={tracks}
          keyExtractor={(t) => String(t.id)}
          renderItem={({ item, index }) => (
            <TrackRow
              track={item}
              active={sameTrack(player.current, item)}
              onPress={() => player.playQueue(tracks, index)}
              right={<TouchableOpacity onPress={() => libraryRowMenu(item, load)} hitSlop={10}><Text style={styles.menuDots}>⋯</Text></TouchableOpacity>}
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
  back: { color: theme.gold, fontSize: 15, fontWeight: "700", paddingVertical: 8, marginBottom: 4 },
  search: { backgroundColor: theme.card, borderRadius: theme.radius, borderWidth: 1, borderColor: theme.line, color: theme.text, paddingHorizontal: 14, height: 44, marginBottom: 6, textAlign: "left" },
  empty: { color: theme.muted, textAlign: "center", marginTop: 60, lineHeight: 24 },
  menuDots: { color: theme.muted, fontSize: 22, paddingHorizontal: 8 },
  libHdr: { flexDirection: "row", alignItems: "center", gap: 12, marginTop: 4, marginBottom: 8 },
  avatar: { width: 52, height: 52, borderRadius: 26, backgroundColor: theme.card2, alignItems: "center", justifyContent: "center", overflow: "hidden" },
  avatarTxt: { color: theme.gold, fontSize: 22, fontWeight: "800" },
  lhName: { color: theme.text, fontSize: 18, fontWeight: "800", textAlign: "left" },
  lhSub: { color: theme.muted, fontSize: 12.5, marginTop: 3, textAlign: "left" },
  gear: { color: theme.muted, fontSize: 22 },
  menu: { marginTop: 10 },
  item: { flexDirection: "row", alignItems: "center", paddingVertical: 15, borderBottomWidth: 1, borderBottomColor: theme.line, gap: 14 },
  itemIc: { color: theme.gold, fontSize: 18, width: 24, textAlign: "center" },
  itemT: { color: theme.text, fontSize: 15.5, fontWeight: "600", flex: 1, textAlign: "left" },
  itemCount: { color: theme.muted, fontSize: 13 },
  itemChev: { color: theme.muted2, fontSize: 20, marginLeft: 8 },
});
