# Orv Music — native app

Open-source cross-platform (iOS / Android) music player that **syncs with your Telegram
bot library**. Forward songs to the bot, and they show up in the app — with a real
native player (background playback, lock-screen controls, shuffle/repeat).

Built with [Expo](https://expo.dev) (React Native + TypeScript). This repository contains
**only the app**; it talks to the hosted Orv Music backend over a public HTTP API.

## How the sync works

There is no password. The app pairs to your Telegram account through the bot:

```
app → POST /api/pair/start            → { code, link: t.me/OrvMusicBot?start=pair_<code> }
app opens the link → Telegram → you tap "Start"
bot approves the code → mints a 30-day session token
app → GET  /api/pair/poll?code=...    → { token }   (one-shot)
app stores the token and sends it as the  X-Init-Data  header on every request
```

That token is the same bearer the web mini-app uses, so the app sees exactly the library,
playlists and community tracks tied to your bot account.

### Google (optional, secondary)

Once paired, you can **link a Google account** (Settings → «اتصال حساب گوگل»). After that,
on any new device you can «ورود با گوگل» and get straight back into your library without
re-pairing. Google is only an alternate key to the *same* Telegram-synced account — it is
never a separate identity.

## Run it

```bash
npm install
npx expo start          # scan the QR with Expo Go, or press a / i for an emulator
```

The API base defaults to the hosted backend (`app.json → extra.apiBase`). Point it at your
own deployment by changing that value.

## Google sign-in setup (optional)

Google sign-in stays disabled until you provide OAuth client IDs. Create them in the
[Google Cloud Console](https://console.cloud.google.com/apis/credentials) (OAuth 2.0 Client
IDs, one per platform), then fill in `app.json → extra`:

```json
"extra": {
  "apiBase": "https://orvteam.com/music",
  "googleExpoClientId": "...apps.googleusercontent.com",
  "googleIosClientId": "...apps.googleusercontent.com",
  "googleAndroidClientId": "...apps.googleusercontent.com",
  "googleWebClientId": "...apps.googleusercontent.com"
}
```

The backend must know the same client IDs (`GOOGLE_CLIENT_IDS` env) so it can validate the
ID token's `aud`.

## Build a standalone app

```bash
npm i -g eas-cli
eas build -p android --profile preview     # APK
eas build -p ios --profile preview
```

## Layout

```
App.tsx                  navigation + auth gate
src/api.ts               HTTP client, token storage, stream/cover URLs
src/auth.ts              Telegram pairing + Google login/link
src/player.tsx           expo-av player (queue, shuffle-bag, repeat, background audio)
src/screens/             Login · Library (+ mini & full player) · Settings
src/theme.ts             "Warm Midnight" palette
```

## License

MIT — see [LICENSE](LICENSE).
