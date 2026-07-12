import React, { createContext, useContext, useEffect, useRef, useState, useCallback } from "react";
import { Audio, AVPlaybackStatus } from "expo-av";
import { Track, trackStreamUrl, trackKey } from "./api";

type Repeat = "off" | "all" | "one";

type PlayerState = {
  queue: Track[];
  index: number;
  current: Track | null;
  isPlaying: boolean;
  isLoading: boolean;
  position: number;
  duration: number;
  shuffle: boolean;
  repeat: Repeat;
  playQueue: (list: Track[], i: number) => Promise<void>;
  toggle: () => Promise<void>;
  next: () => Promise<void>;
  prev: () => Promise<void>;
  seek: (ms: number) => Promise<void>;
  toggleShuffle: () => void;
  cycleRepeat: () => void;
};

const Ctx = createContext<PlayerState | null>(null);
export const usePlayer = () => {
  const v = useContext(Ctx);
  if (!v) throw new Error("usePlayer must be used inside <PlayerProvider>");
  return v;
};

export function PlayerProvider({ children }: { children: React.ReactNode }) {
  const sound = useRef<Audio.Sound | null>(null);
  // a preloaded, already-buffered Sound for the upcoming track, so «بعدی»/auto-advance is instant
  const nextSound = useRef<{ key: string; sound: Audio.Sound } | null>(null);
  const [queue, setQueue] = useState<Track[]>([]);
  const [index, setIndex] = useState(-1);
  const [isPlaying, setPlaying] = useState(false);
  const [isLoading, setLoading] = useState(false);
  const [position, setPosition] = useState(0);
  const [duration, setDuration] = useState(0);
  const [shuffle, setShuffle] = useState(false);
  const [repeat, setRepeat] = useState<Repeat>("all");

  // no-repeat shuffle bag + history, mirroring the web player
  const bag = useRef<number[]>([]);
  const hist = useRef<number[]>([]);
  // refs so the status callback always sees fresh values
  const st = useRef({ queue, index, shuffle, repeat });
  st.current = { queue, index, shuffle, repeat };

  useEffect(() => {
    Audio.setAudioModeAsync({
      staysActiveInBackground: true,
      playsInSilentModeIOS: true,
      shouldDuckAndroid: true,
    }).catch(() => {});
    return () => {
      sound.current?.unloadAsync().catch(() => {});
      nextSound.current?.sound.unloadAsync().catch(() => {});
    };
  }, []);

  const rebuildBag = (idx: number, q: Track[]) => {
    bag.current = q.map((_, i) => i).filter((i) => i !== idx);
  };
  const popShuffle = (): number | null => {
    if (!bag.current.length) return null;
    const k = Math.floor(Math.random() * bag.current.length);
    return bag.current.splice(k, 1)[0];
  };

  const onStatus = useCallback((status: AVPlaybackStatus) => {
    if (!status.isLoaded) return;
    setPlaying(status.isPlaying);
    setPosition(status.positionMillis || 0);
    setDuration(status.durationMillis || 0);
    if (status.didJustFinish && !status.isLooping) {
      void advance(true);
    }
  }, []);

  // The index that WOULD play next in sequential mode (null for shuffle / repeat-one / end).
  const peekNextIdx = (): number | null => {
    const { queue: q, index: idx, shuffle: sh, repeat: rp } = st.current;
    if (!q.length || rp === "one" || sh) return null;
    if (idx < q.length - 1) return idx + 1;
    if (rp === "all") return 0;
    return null;
  };

  // Just resolve + touch the first byte, warming the server's yt-dlp URL cache (the real latency).
  const warm = async (t: Track) => {
    try {
      const uri = await trackStreamUrl(t);
      if (uri && !uri.startsWith("file")) fetch(uri, { headers: { Range: "bytes=0-1" } }).catch(() => {});
    } catch (e) {}
  };

  // Preload (buffer) the upcoming track so advancing to it is instant.
  const prefetchNext = useCallback(async () => {
    const { queue: q, shuffle: sh, repeat: rp } = st.current;
    if (!q.length || rp === "one") return;
    if (sh) {
      const cand = bag.current.length ? q[bag.current[bag.current.length - 1]] : null;
      if (cand) warm(cand);  // random next → just warm, don't buffer the wrong track
      return;
    }
    const ni = peekNextIdx();
    if (ni == null) return;
    const track = q[ni];
    const key = trackKey(track);
    if (nextSound.current?.key === key) return;                 // already preloaded
    if (nextSound.current) { const old = nextSound.current; nextSound.current = null; old.sound.unloadAsync().catch(() => {}); }
    try {
      const uri = await trackStreamUrl(track);
      if (!uri || peekNextIdx() !== ni) return;                 // user moved on
      const { sound: s } = await Audio.Sound.createAsync({ uri }, { shouldPlay: false, progressUpdateIntervalMillis: 500 });
      if (peekNextIdx() !== ni || trackKey(st.current.queue[ni] || ({} as Track)) !== key) { s.unloadAsync().catch(() => {}); return; }
      nextSound.current = { key, sound: s };
    } catch (e) {}
  }, []);

  const loadAt = useCallback(async (i: number, q: Track[]) => {
    const track = q[i];
    if (!track) return;
    setLoading(true);
    setIndex(i);
    try {
      const pre = nextSound.current;
      if (pre && pre.key === trackKey(track)) {
        // reuse the buffered next track — instant start
        nextSound.current = null;
        if (sound.current) { const old = sound.current; sound.current = null; await old.unloadAsync().catch(() => {}); }
        sound.current = pre.sound;
        pre.sound.setOnPlaybackStatusUpdate(onStatus);
        await pre.sound.playAsync();
      } else {
        if (sound.current) { await sound.current.unloadAsync(); sound.current = null; }
        const uri = await trackStreamUrl(track);
        if (!uri) throw new Error("no stream");
        const { sound: s } = await Audio.Sound.createAsync(
          { uri },
          { shouldPlay: true, progressUpdateIntervalMillis: 500 },
          onStatus
        );
        sound.current = s;
      }
    } catch (e) {
      setPlaying(false);
    } finally {
      setLoading(false);
    }
    void prefetchNext();  // buffer the following track while this one plays
  }, [onStatus, prefetchNext]);

  const playQueue = useCallback(async (list: Track[], i: number) => {
    setQueue(list);
    hist.current = [];
    if (st.current.shuffle) rebuildBag(i, list);
    await loadAt(i, list);
  }, [loadAt]);

  const advance = useCallback(async (auto: boolean) => {
    const { queue: q, index: idx, shuffle: sh, repeat: rp } = st.current;
    if (!q.length) return;
    if (rp === "one" && auto) {
      await sound.current?.replayAsync();
      return;
    }
    let nextIdx: number;
    if (sh) {
      let n = popShuffle();
      if (n == null && rp === "all") {
        rebuildBag(idx, q);
        n = popShuffle();
      }
      if (n == null) {
        await sound.current?.pauseAsync();
        return;
      }
      hist.current.push(idx);
      nextIdx = n;
    } else if (idx < q.length - 1) {
      nextIdx = idx + 1;
    } else if (rp === "all") {
      nextIdx = 0;
    } else {
      await sound.current?.pauseAsync();
      return;
    }
    await loadAt(nextIdx, q);
  }, [loadAt]);

  const prev = useCallback(async () => {
    const { queue: q, index: idx, shuffle: sh } = st.current;
    if (position > 3000) {
      await sound.current?.setPositionAsync(0);
      return;
    }
    if (sh) {
      if (hist.current.length) {
        bag.current.push(idx);
        await loadAt(hist.current.pop() as number, q);
      }
      return;
    }
    if (idx > 0) await loadAt(idx - 1, q);
  }, [loadAt, position]);

  const toggle = useCallback(async () => {
    if (!sound.current) return;
    const s = await sound.current.getStatusAsync();
    if (s.isLoaded && s.isPlaying) await sound.current.pauseAsync();
    else await sound.current.playAsync();
  }, []);

  const seek = useCallback(async (ms: number) => {
    await sound.current?.setPositionAsync(ms);
  }, []);

  const toggleShuffle = useCallback(() => {
    setShuffle((v) => {
      const nv = !v;
      if (nv) {
        rebuildBag(st.current.index, st.current.queue);
        hist.current = [];
      }
      return nv;
    });
  }, []);

  const cycleRepeat = useCallback(() => {
    setRepeat((r) => (r === "off" ? "all" : r === "all" ? "one" : "off"));
  }, []);

  const value: PlayerState = {
    queue,
    index,
    current: queue[index] || null,
    isPlaying,
    isLoading,
    position,
    duration,
    shuffle,
    repeat,
    playQueue,
    toggle,
    next: () => advance(false),
    prev,
    seek,
    toggleShuffle,
    cycleRepeat,
  };
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
