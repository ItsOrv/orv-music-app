import React, { useState, useEffect } from "react";
import { View, Text, TouchableOpacity, StyleSheet, Modal, Image, Pressable, ScrollView } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import { theme } from "./theme";
import { coverUrl, trackKey } from "./api";
import { usePlayer } from "./player";
import { fmt, useToast } from "./ui";
import { getDownloadedUri, downloadTrack, removeDownload } from "./downloads";
import { shareTrack } from "./share";

export default function PlayerBar({ bottomOffset }: { bottomOffset: number }) {
  const p = usePlayer();
  const [full, setFull] = useState(false);
  if (!p.current) return null;
  const cover = coverUrl(p.current);
  return (
    <>
      <TouchableOpacity style={[styles.mini, { bottom: bottomOffset }]} onPress={() => setFull(true)} activeOpacity={0.9}>
        <View style={styles.miniCover}>
          {cover ? <Image source={{ uri: cover }} style={styles.img} /> : <Text style={styles.note}>♪</Text>}
        </View>
        <View style={{ flex: 1 }}>
          <Text numberOfLines={1} style={styles.miniT}>{p.current.title || "—"}</Text>
          {!!p.current.artist && <Text numberOfLines={1} style={styles.miniA}>{p.current.artist}</Text>}
        </View>
        <TouchableOpacity onPress={p.toggle} hitSlop={12}><Text style={styles.miniBtn}>{p.isLoading ? "…" : p.isPlaying ? "❚❚" : "▶"}</Text></TouchableOpacity>
        <TouchableOpacity onPress={p.next} hitSlop={12}><Text style={styles.miniBtn}>⏭</Text></TouchableOpacity>
      </TouchableOpacity>
      <Modal visible={full} animationType="slide" onRequestClose={() => setFull(false)}>
        <FullPlayer onClose={() => setFull(false)} />
      </Modal>
    </>
  );
}

type SheetAct = { label: string; danger?: boolean; onPress: () => void };

function FullPlayer({ onClose }: { onClose: () => void }) {
  const p = usePlayer();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const toast = useToast();
  const [downloaded, setDownloaded] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [sheet, setSheet] = useState<SheetAct[] | null>(null);
  const cover = p.current ? coverUrl(p.current) : null;
  const pct = p.duration ? Math.min(1, p.position / p.duration) : 0;
  const key = p.current ? trackKey(p.current) : null;

  useEffect(() => {
    let live = true;
    if (key) getDownloadedUri(key).then((u) => { if (live) setDownloaded(!!u); });
    else setDownloaded(false);
    return () => { live = false; };
  }, [key]);

  const onDownload = async () => {
    const t = p.current;
    if (!t || downloading) return;
    if (downloaded) {
      await removeDownload(trackKey(t));
      setDownloaded(false);
      toast("Removed from downloads");
      return;
    }
    setDownloading(true);
    toast("Downloading…");
    try { await downloadTrack(t); setDownloaded(true); toast("Saved for offline playback ✓"); }
    catch { toast("Couldn't download"); }
    finally { setDownloading(false); }
  };

  const onTimer = () => {
    const acts: SheetAct[] = [15, 30, 45, 60].map((m) => ({ label: `${m} minutes`, onPress: () => p.sleepMinutes(m) }));
    acts.push({ label: "End of this track", onPress: p.sleepEndOfTrack });
    if (p.sleepArmed) acts.push({ label: "Turn timer off", danger: true, onPress: () => { p.clearSleep(); toast("Sleep timer off"); } });
    setSheet(acts);
  };

  const onArtist = () => {
    const name = p.current?.artist;
    if (!name) return;
    onClose();
    navigation.navigate("Artist", { name });
  };

  return (
    <View style={[styles.full, { paddingTop: insets.top + 10, paddingBottom: insets.bottom + 24 }]}>
      <TouchableOpacity onPress={onClose} style={styles.close}><Text style={styles.closeTxt}>⌄</Text></TouchableOpacity>
      <View style={styles.art}>
        {cover ? <Image source={{ uri: cover }} style={styles.img} /> : <Text style={styles.artNote}>♪</Text>}
      </View>
      <Text numberOfLines={1} style={styles.fullT}>{p.current?.title || "—"}</Text>
      <TouchableOpacity onPress={onArtist} disabled={!p.current?.artist}>
        <Text numberOfLines={1} style={styles.fullA}>{p.current?.artist || ""}</Text>
      </TouchableOpacity>

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

      <View style={styles.extras}>
        <TouchableOpacity onPress={onDownload} hitSlop={8}>
          <Text style={[styles.xBtn, downloaded && styles.on]}>{downloading ? "…" : "⤓"}</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={onTimer} hitSlop={8}>
          <Text style={[styles.xBtn, p.sleepArmed && styles.on]}>◷</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => p.current && shareTrack(p.current)} hitSlop={8}>
          <Text style={styles.xBtn}>↗</Text>
        </TouchableOpacity>
      </View>

      {sheet && (
        <Pressable style={styles.sheetBd} onPress={() => setSheet(null)}>
          <Pressable style={[styles.sheet, { paddingBottom: insets.bottom + 16 }]} onPress={() => {}}>
            <View style={styles.grab} />
            <Text style={styles.sheetTitle}>Sleep timer</Text>
            <ScrollView style={{ maxHeight: 380 }}>
              {sheet.map((a, i) => (
                <TouchableOpacity key={i} style={styles.sheetBtn} onPress={() => { setSheet(null); a.onPress(); }}>
                  <Text style={[styles.sheetBtnTxt, a.danger && { color: theme.danger }]}>{a.label}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
            <TouchableOpacity style={styles.sheetCancel} onPress={() => setSheet(null)}><Text style={styles.sheetCancelTxt}>Cancel</Text></TouchableOpacity>
          </Pressable>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  img: { width: "100%", height: "100%" },
  note: { color: theme.muted2, fontSize: 18 },
  mini: { position: "absolute", left: 12, right: 12, height: 62, backgroundColor: theme.card, borderRadius: theme.radius, borderWidth: 1, borderColor: theme.line, flexDirection: "row", alignItems: "center", paddingHorizontal: 10, gap: 10 },
  miniCover: { width: 42, height: 42, borderRadius: 8, backgroundColor: theme.card2, alignItems: "center", justifyContent: "center", overflow: "hidden" },
  miniT: { color: theme.text, fontSize: 13.5, fontWeight: "600", textAlign: "left" },
  miniA: { color: theme.muted, fontSize: 11.5, marginTop: 2, textAlign: "left" },
  miniBtn: { color: theme.text, fontSize: 18, paddingHorizontal: 8 },
  full: { flex: 1, backgroundColor: theme.bg, alignItems: "center", paddingHorizontal: 28 },
  close: { alignSelf: "flex-start" },
  closeTxt: { color: theme.muted, fontSize: 30 },
  art: { width: 260, height: 260, borderRadius: theme.radiusLg, backgroundColor: theme.card2, alignItems: "center", justifyContent: "center", overflow: "hidden", marginTop: 20, marginBottom: 28 },
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
  playIcon: { color: "#ffffff", fontSize: 26, fontWeight: "800" },
  extras: { flexDirection: "row", alignItems: "center", justifyContent: "space-evenly", width: "100%", marginTop: 28 },
  xBtn: { color: theme.muted, fontSize: 24, paddingHorizontal: 12, paddingVertical: 6 },
  sheetBd: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" },
  sheet: { backgroundColor: theme.card, borderTopLeftRadius: theme.radiusLg, borderTopRightRadius: theme.radiusLg, borderWidth: 1, borderColor: theme.line, paddingHorizontal: 14, paddingTop: 8 },
  grab: { width: 38, height: 4, borderRadius: 2, backgroundColor: theme.line, alignSelf: "center", marginBottom: 12 },
  sheetTitle: { color: theme.muted, fontSize: 12.5, fontWeight: "600", textAlign: "center", paddingBottom: 12 },
  sheetBtn: { backgroundColor: theme.card2, borderWidth: 1, borderColor: theme.line, borderRadius: theme.radius, paddingVertical: 15, paddingHorizontal: 16, marginBottom: 7 },
  sheetBtnTxt: { color: theme.text, fontSize: 14.5, fontWeight: "600", textAlign: "left" },
  sheetCancel: { paddingVertical: 14, alignItems: "center", marginTop: 4 },
  sheetCancelTxt: { color: theme.muted, fontSize: 14, fontWeight: "600" },
});
