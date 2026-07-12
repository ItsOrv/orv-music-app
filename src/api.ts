import Constants from "expo-constants";
import * as SecureStore from "expo-secure-store";

const extra = (Constants.expoConfig?.extra ?? {}) as Record<string, string>;
export const API_BASE = (extra.apiBase || "https://orvteam.com/music").replace(/\/$/, "");

const TOKEN_KEY = "orv_music_token";
let cachedToken: string | null = null;

export async function getToken(): Promise<string | null> {
  if (cachedToken) return cachedToken;
  cachedToken = await SecureStore.getItemAsync(TOKEN_KEY);
  return cachedToken;
}

export function getTokenSync(): string {
  return cachedToken || "";
}

export async function setToken(token: string): Promise<void> {
  cachedToken = token;
  await SecureStore.setItemAsync(TOKEN_KEY, token);
}

export async function clearToken(): Promise<void> {
  cachedToken = null;
  await SecureStore.deleteItemAsync(TOKEN_KEY);
}

async function authHeaders(): Promise<Record<string, string>> {
  const t = await getToken();
  return t ? { "X-Init-Data": t } : {};
}

export async function api<T = any>(path: string, init: RequestInit = {}): Promise<T> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(await authHeaders()),
    ...((init.headers as Record<string, string>) || {}),
  };
  const res = await fetch(`${API_BASE}/api/${path.replace(/^\//, "")}`, { ...init, headers });
  if (res.status === 401) throw new AuthError();
  if (!res.ok) throw new Error(`${res.status} ${await res.text().catch(() => "")}`.trim());
  const ct = res.headers.get("content-type") || "";
  return (ct.includes("application/json") ? await res.json() : (undefined as any)) as T;
}

export class AuthError extends Error {
  constructor() {
    super("unauthorized");
    this.name = "AuthError";
  }
}

// ---------- track model (mirrors the web mini-app) ----------
export type Track = {
  id?: number | null;        // set for library tracks
  title: string | null;
  artist: string | null;
  duration?: number;
  source?: string;           // "tg" | "yt" | "dz" | "lib"
  ext_id?: string;           // deezer/yt id for discover tracks
  cover?: string | null;     // direct cover url (discover)
  cover_url?: string | null; // stored cover url (library yt tracks)
  has_cover?: boolean;       // library tg track cover via /cover/{id}
  external?: boolean;        // discover result (deezer)
  preview?: string | null;   // deezer 30s preview fallback
  community?: boolean;
  plays?: number;
};

// unique id used for dedup / "is this the playing track"
export function trackKey(t: Track): string {
  if (t.community) return "c" + t.id;
  if (t.id != null) return "l" + t.id;
  return (t.source || "x") + ":" + t.ext_id;
}

export function sameTrack(a: Track | null, b: Track | null): boolean {
  return !!a && !!b && trackKey(a) === trackKey(b);
}

export function coverUrl(t: Track): string | null {
  const auth = encodeURIComponent(getTokenSync());
  if (t.cover_url) return t.cover_url;
  if (t.external) return t.cover || null;
  if (t.community) return t.has_cover ? `${API_BASE}/api/community/cover/${t.id}?auth=${auth}` : null;
  if (t.has_cover) return `${API_BASE}/api/cover/${t.id}?auth=${auth}`;
  return null;
}

// Build the streaming URL. Discover (deezer) tracks are resolved to a YouTube stream on the fly.
export async function trackStreamUrl(t: Track): Promise<string | null> {
  const auth = encodeURIComponent(getTokenSync());
  if (t.community) return `${API_BASE}/api/community/stream/${t.id}?auth=${auth}`;
  if (t.id != null) return `${API_BASE}/api/stream/${t.id}?auth=${auth}`;
  if (t.source === "yt" && t.ext_id) return `${API_BASE}/api/yt/stream/${t.ext_id}?auth=${auth}`;
  try {
    const r = await api<{ ext_id: string }>(`yt/resolve?q=${encodeURIComponent(`${t.artist || ""} ${t.title || ""}`.trim())}`);
    return `${API_BASE}/api/yt/stream/${r.ext_id}?auth=${auth}`;
  } catch {
    return t.preview || null;
  }
}

// ---------- endpoint helpers ----------
export type Me = {
  id: number;
  username: string | null;
  first_name: string | null;
  tracks: number;
  google_linked: boolean;
};

export type Playlist = { id: number; name: string; count: number };
export type ForYou = {
  chart: Track[];
  new_releases: { album_id: number; title: string; artist: string; cover: string }[];
  genres: { id: number; name: string; cover: string }[];
};

export const getMe = () => api<Me>("me");
export const getTracks = (q?: string) => api<Track[]>(`tracks${q ? `?q=${encodeURIComponent(q)}` : ""}`);
export const deleteTrack = (id: number) => api(`tracks/${id}`, { method: "DELETE" });

export const discoverSearch = (q: string) => api<Track[]>(`discover/search?q=${encodeURIComponent(q)}`);
export const discoverForYou = () => api<ForYou>("discover/foryou");
export const discoverGenre = (id: number) => api<Track[]>(`discover/genre/${id}`);
export const discoverAlbum = (id: number) => api<Track[]>(`discover/album/${id}`);

export const communityTracks = (q?: string) => api<Track[]>(`community/tracks${q ? `?q=${encodeURIComponent(q)}` : ""}`);
export const communitySave = (trackId: number) => api<{ id: number }>("community/save", { method: "POST", body: JSON.stringify({ track_id: trackId }) });

export const listPlaylists = () => api<Playlist[]>("playlists");
export const createPlaylist = (name: string) => api<Playlist>("playlists", { method: "POST", body: JSON.stringify({ name }) });
export const deletePlaylist = (id: number) => api(`playlists/${id}`, { method: "DELETE" });
export const playlistTracks = (id: number) => api<Track[]>(`playlists/${id}/tracks`);
export const addToPlaylist = (pid: number, trackId: number) => api(`playlists/${pid}/tracks`, { method: "POST", body: JSON.stringify({ track_id: trackId }) });
export const removeFromPlaylist = (pid: number, trackId: number) => api(`playlists/${pid}/tracks/${trackId}`, { method: "DELETE" });

export const sendTrack = (trackId: number) => api("send/track", { method: "POST", body: JSON.stringify({ track_id: trackId }) });
export const sendPlaylist = (playlistId: number) => api<{ count: number }>("send/playlist", { method: "POST", body: JSON.stringify({ playlist_id: playlistId }) });

// Add a track to the library. For discover tracks, resolve to a yt id first, then persist.
// Returns the new (or existing) library track id.
export async function addToLibrary(t: Track): Promise<number | null> {
  let extId = t.ext_id;
  if (t.source !== "yt") {
    const r = await api<{ ext_id: string }>(`yt/resolve?q=${encodeURIComponent(`${t.artist || ""} ${t.title || ""}`.trim())}`);
    extId = r.ext_id;
  }
  const res = await api<{ id: number }>("library/add", {
    method: "POST",
    body: JSON.stringify({ ext_id: extId, title: t.title, artist: t.artist, duration: t.duration, cover: t.cover }),
  });
  return res?.id ?? null;
}
