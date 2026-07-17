import React, { useEffect, useState, useCallback } from "react";
import { View, Text, ScrollView, FlatList, TouchableOpacity, Image, ActivityIndicator, StyleSheet } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { theme } from "../theme";
import { discoverArtist, discoverAlbum, ArtistInfo, Track, sameTrack } from "../api";
import { usePlayer } from "../player";
import { TrackRow, CoverCard, Rail, SectionHeader } from "../ui";
import { useTrackActions } from "../actions";

type SubView = { title: string; tracks: Track[] } | null;

export default function ArtistScreen({ route, navigation }: any) {
  const name: string = route.params?.name || "";
  const insets = useSafeAreaInsets();
  const [artist, setArtist] = useState<ArtistInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [sub, setSub] = useState<SubView>(null);
  const player = usePlayer();
  const { exploreRowMenu } = useTrackActions();

  const load = useCallback(async () => {
    setLoading(true);
    setFailed(false);
    try { setArtist(await discoverArtist(name)); } catch { setFailed(true); } finally { setLoading(false); }
  }, [name]);

  useEffect(() => { load(); }, [load]);

  const menuBtn = (track: Track) => (
    <TouchableOpacity onPress={() => exploreRowMenu(track)} hitSlop={10}><Text style={styles.add}>＋</Text></TouchableOpacity>
  );

  const openAlbum = async (id: number, title: string) => {
    setLoading(true);
    try { setSub({ title, tracks: await discoverAlbum(id) }); } catch { setSub({ title, tracks: [] }); } finally { setLoading(false); }
  };

  if (sub) {
    return (
      <View style={[styles.wrap, { paddingTop: insets.top + 8 }]}>
        <TouchableOpacity onPress={() => setSub(null)}><Text style={styles.back}>‹ {sub.title}</Text></TouchableOpacity>
        {loading ? <ActivityIndicator color={theme.gold} style={{ marginTop: 40 }} /> : sub.tracks.length ? (
          <FlatList
            data={sub.tracks}
            keyExtractor={(t, i) => (t.ext_id || String(i))}
            renderItem={({ item, index }) => (
              <TrackRow track={item} active={sameTrack(player.current, item)} onPress={() => player.playQueue(sub.tracks, index)} right={menuBtn(item)} />
            )}
            contentContainerStyle={{ paddingBottom: 150 }}
          />
        ) : <Text style={styles.empty}>Nothing here.</Text>}
      </View>
    );
  }

  return (
    <View style={[styles.wrap, { paddingTop: insets.top + 8 }]}>
      <TouchableOpacity onPress={() => navigation.goBack()}><Text style={styles.back}>‹ Back</Text></TouchableOpacity>
      {loading ? (
        <ActivityIndicator color={theme.gold} style={{ marginTop: 40 }} />
      ) : failed || !artist ? (
        <Text style={styles.empty}>This artist's page wasn't found.</Text>
      ) : (
        <ScrollView contentContainerStyle={{ paddingBottom: 150 }} showsVerticalScrollIndicator={false}>
          <View style={styles.head}>
            <View style={styles.pic}>
              {artist.picture ? <Image source={{ uri: artist.picture }} style={styles.img} /> : <Text style={styles.picNote}>🎤</Text>}
            </View>
            <View style={{ flex: 1 }}>
              <Text numberOfLines={2} style={styles.name}>{artist.name}</Text>
              {!!artist.fans && <Text style={styles.fans}>{Number(artist.fans).toLocaleString("en-US")} followers</Text>}
              {!!artist.top?.length && (
                <TouchableOpacity style={styles.playTop} onPress={() => player.playQueue(artist.top, 0)}>
                  <Text style={styles.playTopTxt}>▶ Play top</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>

          {artist.top?.length ? (
            <>
              <SectionHeader>Top Songs</SectionHeader>
              {artist.top.map((t, i) => (
                <TrackRow key={t.ext_id || i} track={t} active={sameTrack(player.current, t)} onPress={() => player.playQueue(artist.top, i)} right={menuBtn(t)} />
              ))}
            </>
          ) : (
            <Text style={styles.empty}>No songs found.</Text>
          )}

          {!!artist.albums?.length && (
            <>
              <SectionHeader>Albums</SectionHeader>
              <Rail>
                {artist.albums.map((al) => (
                  <CoverCard key={al.album_id} uri={al.cover} title={al.title} subtitle={al.year ? String(al.year) : ""} onPress={() => openAlbum(al.album_id, al.title)} />
                ))}
              </Rail>
            </>
          )}

          {!!artist.related?.length && (
            <>
              <SectionHeader>Similar Artists</SectionHeader>
              <Rail>
                {artist.related.map((r) => (
                  <CoverCard key={r.name} uri={r.picture} title={r.name} onPress={() => navigation.push("Artist", { name: r.name })} />
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
  back: { color: theme.gold, fontSize: 15, fontWeight: "700", paddingVertical: 8, marginBottom: 4 },
  empty: { color: theme.muted, textAlign: "center", marginTop: 60, lineHeight: 24 },
  add: { color: theme.gold, fontSize: 24, fontWeight: "700", paddingHorizontal: 8 },
  img: { width: "100%", height: "100%" },
  head: { flexDirection: "row", alignItems: "center", gap: 16, marginTop: 8, marginBottom: 8 },
  pic: { width: 110, height: 110, borderRadius: 55, backgroundColor: theme.card2, alignItems: "center", justifyContent: "center", overflow: "hidden" },
  picNote: { fontSize: 40 },
  name: { color: theme.text, fontSize: 22, fontWeight: "800", textAlign: "left" },
  fans: { color: theme.muted, fontSize: 12.5, marginTop: 5, textAlign: "left" },
  playTop: { alignSelf: "flex-start", backgroundColor: theme.gold, borderRadius: 999, paddingHorizontal: 16, paddingVertical: 8, marginTop: 12 },
  playTopTxt: { color: "#ffffff", fontSize: 13, fontWeight: "800" },
});
