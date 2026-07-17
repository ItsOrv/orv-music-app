import * as FileSystem from "expo-file-system";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { API_BASE, Track, trackKey, coverUrl, getTokenSync, api } from "./api";

const INDEX_KEY = "orv_dl_index";

export type DownloadMeta = {
  uid: string;
  title: string;
  artist: string;
  cover: string | null;
  duration?: number;
  source?: string;
  id?: number | null;
  ext_id?: string;
  community?: boolean;
  fileUri: string;
  size: number;
  at: number;
};

async function readIndex(): Promise<Record<string, DownloadMeta>> {
  try {
    const raw = await AsyncStorage.getItem(INDEX_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

async function writeIndex(idx: Record<string, DownloadMeta>): Promise<void> {
  try { await AsyncStorage.setItem(INDEX_KEY, JSON.stringify(idx)); } catch {}
}

export async function listDownloads(): Promise<DownloadMeta[]> {
  const idx = await readIndex();
  return Object.values(idx).sort((a, b) => b.at - a.at);
}

export async function getDownloadedUri(uid: string): Promise<string | null> {
  const idx = await readIndex();
  return idx[uid]?.fileUri || null;
}

async function downloadUrl(t: Track): Promise<string | null> {
  const auth = encodeURIComponent(getTokenSync());
  if (t.community) return `${API_BASE}/api/community/stream/${t.id}?auth=${auth}`;
  if (t.id != null) return `${API_BASE}/api/stream/${t.id}?auth=${auth}`;
  if (t.source === "yt" && t.ext_id) return `${API_BASE}/api/yt/stream/${t.ext_id}?auth=${auth}`;
  const r = await api<{ ext_id: string }>(`yt/resolve?q=${encodeURIComponent(`${t.artist || ""} ${t.title || ""}`.trim())}`);
  return `${API_BASE}/api/yt/stream/${r.ext_id}?auth=${auth}`;
}

export async function downloadTrack(t: Track): Promise<DownloadMeta> {
  const uid = trackKey(t);
  const url = await downloadUrl(t);
  if (!url) throw new Error("no stream");
  const dir = `${FileSystem.documentDirectory}offline/`;
  await FileSystem.makeDirectoryAsync(dir, { intermediates: true }).catch(() => {});
  const fileUri = `${dir}${uid.replace(/[^a-zA-Z0-9_-]/g, "_")}.mp3`;
  const res = await FileSystem.downloadAsync(url, fileUri);
  if (res.status >= 400) {
    await FileSystem.deleteAsync(fileUri, { idempotent: true }).catch(() => {});
    throw new Error("download failed");
  }
  const info = await FileSystem.getInfoAsync(fileUri);
  const meta: DownloadMeta = {
    uid,
    title: t.title || "Untitled",
    artist: t.artist || "",
    cover: coverUrl(t),
    duration: t.duration,
    source: t.source || (t.id != null ? "lib" : "x"),
    id: t.id ?? null,
    ext_id: t.ext_id,
    community: t.community,
    fileUri,
    size: info.exists ? info.size || 0 : 0,
    at: Date.now(),
  };
  const idx = await readIndex();
  idx[uid] = meta;
  await writeIndex(idx);
  return meta;
}

export async function removeDownload(uid: string): Promise<void> {
  const idx = await readIndex();
  const m = idx[uid];
  if (!m) return;
  await FileSystem.deleteAsync(m.fileUri, { idempotent: true }).catch(() => {});
  delete idx[uid];
  await writeIndex(idx);
}

export function metaTrack(m: DownloadMeta): Track {
  return {
    id: m.community || m.source === "lib" ? m.id : null,
    community: m.community,
    source: m.source === "lib" ? undefined : m.source,
    ext_id: m.ext_id,
    title: m.title,
    artist: m.artist,
    duration: m.duration,
    cover_url: m.cover || null,
  };
}

export function fmtSize(b: number): string {
  b = b || 0;
  if (b < 1024 * 1024) return (b / 1024).toFixed(0) + " KB";
  return (b / 1024 / 1024).toFixed(1) + " MB";
}
