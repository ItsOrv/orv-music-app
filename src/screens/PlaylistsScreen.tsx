import React, { useEffect, useState, useCallback } from "react";
import { View, Text, FlatList, TouchableOpacity, ActivityIndicator, StyleSheet, Alert } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { theme } from "../theme";
import {
  listPlaylists, createPlaylist, deletePlaylist, playlistTracks, removeFromPlaylist,
  sendPlaylist, Playlist, Track, sameTrack,
} from "../api";
import { usePlayer } from "../player";
import { TrackRow } from "../ui";
import { usePrompt } from "../prompt";
import { useToast } from "../ui";

export default function PlaylistsScreen() {
  const insets = useSafeAreaInsets();
  const [pls, setPls] = useState<Playlist[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState<Playlist | null>(null);
  const [tracks, setTracks] = useState<Track[]>([]);
  const [tLoading, setTLoading] = useState(false);
  const player = usePlayer();
  const prompt = usePrompt();
  const toast = useToast();

  const load = useCallback(async () => {
    setLoading(true);
    try { setPls(await listPlaylists()); } catch { setPls([]); } finally { setLoading(false); }
  }, []);
  useEffect(() => { load(); }, [load]);

  const openPlaylist = async (p: Playlist) => {
    setOpen(p); setTLoading(true);
    try { setTracks(await playlistTracks(p.id)); } catch { setTracks([]); } finally { setTLoading(false); }
  };

  const create = async () => {
    const name = await prompt("پلی‌لیستِ جدید", "اسمِ پلی‌لیست");
    if (!name) return;
    try { await createPlaylist(name); load(); } catch { toast("ساخته نشد"); }
  };

  const remove = (p: Playlist) => {
    Alert.alert("حذف پلی‌لیست", `«${p.name}» حذف بشه؟`, [
      { text: "انصراف", style: "cancel" },
      { text: "حذف", style: "destructive", onPress: async () => { try { await deletePlaylist(p.id); load(); } catch { toast("حذف نشد"); } } },
    ]);
  };

  const removeTrack = (t: Track) => {
    if (!open || t.id == null) return;
    Alert.alert("حذف از پلی‌لیست", `«${t.title}» از این پلی‌لیست حذف بشه؟`, [
      { text: "انصراف", style: "cancel" },
      { text: "حذف", style: "destructive", onPress: async () => { try { await removeFromPlaylist(open.id, t.id as number); openPlaylist(open); } catch { toast("حذف نشد"); } } },
    ]);
  };

  const send = async () => {
    if (!open) return;
    toast("پلی‌لیست داره می‌ره تو تلگرام…");
    try { const r = await sendPlaylist(open.id); toast(`${r.count || 0} آهنگ فرستاده شد ✓`); }
    catch { toast("ارسال نشد"); }
  };

  // ----- open playlist detail -----
  if (open) {
    return (
      <View style={[styles.wrap, { paddingTop: insets.top + 8 }]}>
        <View style={styles.detailHead}>
          <TouchableOpacity onPress={() => setOpen(null)}><Text style={styles.back}>‹ {open.name}</Text></TouchableOpacity>
          {tracks.length > 0 && <TouchableOpacity style={styles.sendBtn} onPress={send}><Text style={styles.sendTxt}>بفرست به تلگرام</Text></TouchableOpacity>}
        </View>
        {tLoading ? <ActivityIndicator color={theme.gold} style={{ marginTop: 40 }} /> :
          tracks.length === 0 ? <Text style={styles.empty}>این پلی‌لیست خالیه.{"\n"}از کتابخونه یا اکسپلور، آهنگ اضافه کن.</Text> : (
            <FlatList
              data={tracks}
              keyExtractor={(t) => String(t.id)}
              renderItem={({ item, index }) => (
                <TrackRow track={item} active={sameTrack(player.current, item)} onPress={() => player.playQueue(tracks, index)}
                  right={<TouchableOpacity onPress={() => removeTrack(item)} hitSlop={10}><Text style={styles.rm}>✕</Text></TouchableOpacity>} />
              )}
              contentContainerStyle={{ paddingBottom: 150 }}
            />
          )}
      </View>
    );
  }

  // ----- playlists list -----
  return (
    <View style={[styles.wrap, { paddingTop: insets.top + 8 }]}>
      <View style={styles.header}>
        <Text style={styles.title}>پلی‌لیست‌ها</Text>
        <TouchableOpacity style={styles.newBtn} onPress={create}><Text style={styles.newTxt}>+ جدید</Text></TouchableOpacity>
      </View>
      {loading ? <ActivityIndicator color={theme.gold} style={{ marginTop: 40 }} /> :
        pls.length === 0 ? <Text style={styles.empty}>پلی‌لیستی نساختی.{"\n"}یکی بساز و آهنگا رو دسته‌بندی کن.</Text> : (
          <FlatList
            data={pls}
            keyExtractor={(p) => String(p.id)}
            renderItem={({ item }) => (
              <TouchableOpacity style={styles.card} onPress={() => openPlaylist(item)} onLongPress={() => remove(item)} activeOpacity={0.7}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.cardName}>{item.name}</Text>
                  <Text style={styles.cardCount}>{item.count} آهنگ</Text>
                </View>
                <TouchableOpacity onPress={() => remove(item)} hitSlop={10}><Text style={styles.rm}>🗑</Text></TouchableOpacity>
              </TouchableOpacity>
            )}
            contentContainerStyle={{ paddingBottom: 150 }}
          />
        )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: theme.bg, paddingHorizontal: 16 },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 12 },
  title: { color: theme.text, fontSize: 20, fontWeight: "800" },
  newBtn: { backgroundColor: theme.gold, borderRadius: 999, paddingHorizontal: 14, paddingVertical: 8 },
  newTxt: { color: "#ffffff", fontWeight: "800", fontSize: 13 },
  empty: { color: theme.muted, textAlign: "center", marginTop: 60, lineHeight: 24 },
  card: { flexDirection: "row", alignItems: "center", backgroundColor: theme.card, borderRadius: theme.radius, borderWidth: 1, borderColor: theme.line, padding: 16, marginBottom: 9 },
  cardName: { color: theme.text, fontSize: 15, fontWeight: "700", textAlign: "right" },
  cardCount: { color: theme.muted, fontSize: 12, marginTop: 4, textAlign: "right" },
  rm: { color: theme.muted, fontSize: 18, paddingHorizontal: 6 },
  detailHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 8 },
  back: { color: theme.gold, fontSize: 15, fontWeight: "700", paddingVertical: 8 },
  sendBtn: { borderWidth: 1, borderColor: theme.gold, borderRadius: 999, paddingHorizontal: 14, paddingVertical: 7 },
  sendTxt: { color: theme.gold, fontWeight: "700", fontSize: 12.5 },
});
