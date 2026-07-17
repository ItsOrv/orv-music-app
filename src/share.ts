import { Share } from "react-native";
import { Track } from "./api";

const B64 = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";

function utf8Bytes(s: string): number[] {
  const out: number[] = [];
  for (let i = 0; i < s.length; i++) {
    const c = s.codePointAt(i) as number;
    if (c > 0xffff) i++;
    if (c < 0x80) out.push(c);
    else if (c < 0x800) out.push(0xc0 | (c >> 6), 0x80 | (c & 63));
    else if (c < 0x10000) out.push(0xe0 | (c >> 12), 0x80 | ((c >> 6) & 63), 0x80 | (c & 63));
    else out.push(0xf0 | (c >> 18), 0x80 | ((c >> 12) & 63), 0x80 | ((c >> 6) & 63), 0x80 | (c & 63));
  }
  return out;
}

export function b64u(s: string): string {
  const b = utf8Bytes(s);
  let out = "";
  for (let i = 0; i < b.length; i += 3) {
    const n = (b[i] << 16) | ((b[i + 1] ?? 0) << 8) | (b[i + 2] ?? 0);
    out += B64[(n >> 18) & 63] + B64[(n >> 12) & 63];
    if (i + 1 < b.length) out += B64[(n >> 6) & 63];
    if (i + 2 < b.length) out += B64[n & 63];
  }
  return out;
}

export function shareLink(t: Track): string {
  const p = t.ext_id && (t.source === "dz" || t.source === "yt")
    ? { s: t.source, e: t.ext_id, t: t.title, a: t.artist, c: t.cover, d: t.duration }
    : { q: `${t.artist || ""} ${t.title || ""}`.trim(), t: t.title, a: t.artist };
  return "https://orvteam.com/music/?share=" + b64u(JSON.stringify(p));
}

export async function shareTrack(t: Track): Promise<void> {
  const url = shareLink(t);
  const text = `🎵 ${t.title || "Untitled"}${t.artist ? " — " + t.artist : ""}`;
  try { await Share.share({ message: `${text}\n${url}`, url }); } catch {}
}
