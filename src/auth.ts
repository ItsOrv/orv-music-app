import * as Linking from "expo-linking";
import { api, setToken, clearToken, getMe, Me } from "./api";

// Extract a session token from a deep link like orvmusic://auth?t=<token> or any ?t= URL.
export function tokenFromUrl(url: string | null): string | null {
  if (!url) return null;
  try {
    const q = Linking.parse(url).queryParams?.t;
    const t = Array.isArray(q) ? q[0] : q;
    return typeof t === "string" && t.startsWith("w.") ? t : null;
  } catch {
    return null;
  }
}

// Log in from a token carried in a deep link.
export async function loginWithToken(token: string): Promise<Me> {
  await setToken(token);
  return getMe();
}

export type PairSession = { code: string; link: string };

// Ask the server for a one-time pairing code + the bot deep-link that carries it.
export async function startPairing(): Promise<PairSession> {
  const r = await api<{ code: string; link: string; expires_in: number }>("pair/start", { method: "POST" });
  return { code: r.code, link: r.link };
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// Poll until the user taps Start in the bot (which approves the code and yields a token).
// Transient network errors are swallowed and retried — only "expired"/timeout stop the loop,
// so a flaky connection doesn't abort a pairing the user is mid-way through.
export async function pollPairing(code: string, timeoutMs = 300000): Promise<Me> {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    try {
      const r = await api<{ status: string; token?: string; user?: any }>(`pair/poll?code=${encodeURIComponent(code)}`);
      if (r.status === "ok" && r.token) {
        await setToken(r.token);
        return api<Me>("me");
      }
      if (r.status === "expired") throw new Error("expired");
    } catch (e: any) {
      if (e?.message === "expired") throw e; // server says the code is gone — stop
      // otherwise transient (network blip) — keep polling
    }
    await sleep(2000);
  }
  throw new Error("timeout");
}

// Full flow: get a code, open Telegram to the bot, then wait for approval.
export async function pairWithTelegram(): Promise<Me> {
  const { code, link } = await startPairing();
  await Linking.openURL(link);
  return pollPairing(code);
}

// Google (secondary sign-in): exchange a Google ID token for our own session token.
export async function googleLogin(idToken: string): Promise<Me> {
  const r = await api<{ token: string; user: any }>("google/login", {
    method: "POST",
    body: JSON.stringify({ id_token: idToken }),
  });
  await setToken(r.token);
  return api<Me>("me");
}

// Link a Google account to the already-signed-in (paired) account.
export async function googleLink(idToken: string): Promise<{ email?: string }> {
  return api("google/link", { method: "POST", body: JSON.stringify({ id_token: idToken }) });
}

export async function logout(): Promise<void> {
  await clearToken();
}
