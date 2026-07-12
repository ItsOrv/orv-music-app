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

// Synchronous read of the in-memory token — valid after getToken()/setToken() has run once.
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

// The server accepts the web-token in the X-Init-Data header (same slot as Telegram initData).
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

// Streaming URL for a track. The token rides in the query so the native <Audio> player can fetch it.
export function trackStreamUrl(track: Track): string {
  const t = encodeURIComponent(getTokenSync());
  const base = track.community ? "community/stream" : "stream";
  return `${API_BASE}/api/${base}/${track.id}?auth=${t}`;
}

export function coverUrl(track: Track): string | null {
  if (track.cover_url) return track.cover_url;
  const t = encodeURIComponent(getTokenSync());
  if (track.community) return `${API_BASE}/api/community/cover/${track.id}?auth=${t}`;
  if (track.has_cover) return `${API_BASE}/api/cover/${track.id}?auth=${t}`;
  return null;
}

export type Track = {
  id: number;
  title: string | null;
  artist: string | null;
  duration?: number;
  cover_url?: string | null;
  has_cover?: boolean;
  community?: boolean;
  plays?: number;
};

export type Me = {
  id: number;
  username: string | null;
  first_name: string | null;
  tracks: number;
  google_linked: boolean;
};
