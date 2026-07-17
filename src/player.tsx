import React, { createContext, useContext, useEffect, useRef, useState, useCallback } from "react";
import { Audio, AVPlaybackStatus } from "expo-av";
import { Track, trackStreamUrl, trackKey, discoverRadio } from "./api";
import { getDownloadedUri } from "./downloads";
import { initPrefs, autoplayOn } from "./prefs";
import { useToast } from "./ui";

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
  sleepArmed: boolean;
  sleepMinutes: (mins: number) => void;
  sleepEndOfTrack: () => void;
  clearSleep: () => void;
};

const Ctx = createContext<PlayerState | null>(null);
export const usePlayer = () => {
  const v = useContext(Ctx);
  if (!v) throw new Error("usePlayer must be used inside <PlayerProvider>");
  return v;
};

export function PlayerProvider({ children }: { children: React.ReactNode }) {
  const sound = useRef<Audio.Sound | null>(null);
  const [queue, setQueue] = useState<Track[]>([]);
  const [index, setIndex] = useState(-1);
  const [isPlaying, setPlaying] = useState(false);
  const [isLoading, setLoading] = useState(false);
  const [position, setPosition] = useState(0);
  const [duration, setDuration] = useState(0);
  const [shuffle, setShuffle] = useState(false);
  const [repeat, setRepeat] = useState<Repeat>("all");
  const [sleepArmed, setSleepArmed] = useState(false);
  const sleepEnd = useRef(false);
  const sleepTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const radioBusy = useRef(false);
  const toast = useToast();

  // no-repeat shuffle bag + history, mirroring the web player
  const bag = useRef<number[]>([]);
  const hist = useRef<number[]>([]);
  // refs so the status callback always sees fresh values
  const st = useRef({ queue, index, shuffle, repeat });
  st.current = { queue, index, shuffle, repeat };

  useEffect(() => {
    initPrefs();
    Audio.setAudioModeAsync({
      staysActiveInBackground: true,
      playsInSilentModeIOS: true,
      shouldDuckAndroid: true,
    }).catch(() => {});
    return () => {
      sound.current?.unloadAsync().catch(() => {});
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
      if (sleepEnd.current) {
        clearSleep();
        toast("Sleep timer: music paused 😴");
        void sound.current?.setStatusAsync({ shouldPlay: false, positionMillis: 0 }).catch(() => {});
        return;
      }
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
      if (await getDownloadedUri(trackKey(t))) return;
      const uri = await trackStreamUrl(t);
      if (uri && !uri.startsWith("file")) fetch(uri, { headers: { Range: "bytes=0-1" } }).catch(() => {});
    } catch (e) {}
  };

  // Warm the upcoming track's server URL cache so advancing starts without the resolve delay.
  // Deliberately does NOT buffer the whole song — that doubled users' data usage.
  const prefetchNext = useCallback(async () => {
    const { queue: q, shuffle: sh, repeat: rp } = st.current;
    if (!q.length || rp === "one") return;
    if (sh) {
      const cand = bag.current.length ? q[bag.current[bag.current.length - 1]] : null;
      if (cand) warm(cand);
      return;
    }
    const ni = peekNextIdx();
    if (ni == null) return;
    warm(q[ni]);
  }, []);

  const loadAt = useCallback(async (i: number, q: Track[]) => {
    const track = q[i];
    if (!track) return;
    setLoading(true);
    setIndex(i);
    try {
      if (sound.current) { await sound.current.unloadAsync(); sound.current = null; }
      const uri = (await getDownloadedUri(trackKey(track))) || (await trackStreamUrl(track));
      if (!uri) throw new Error("no stream");
      const { sound: s } = await Audio.Sound.createAsync(
        { uri },
        { shouldPlay: true, progressUpdateIntervalMillis: 500 },
        onStatus
      );
      sound.current = s;
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

  // queue ran out (repeat off) → keep going with similar tracks, like the web player
  const autoplayExtend = useCallback(async () => {
    const { queue: q, index: idx, shuffle: sh } = st.current;
    const t = q[idx];
    if (radioBusy.current || !t || !t.artist) {
      await sound.current?.pauseAsync();
      return;
    }
    radioBusy.current = true;
    try {
      const list = await discoverRadio(t.artist);
      const have = new Set(q.map(trackKey));
      const fresh = (list || []).filter((x) => !have.has(trackKey(x)));
      if (!fresh.length) {
        await sound.current?.pauseAsync();
        return;
      }
      const nq = [...q, ...fresh];
      setQueue(nq);
      let nextIdx = q.length;
      if (sh) {
        for (let i = q.length; i < nq.length; i++) bag.current.push(i);
        nextIdx = popShuffle() as number;
        hist.current.push(idx);
      }
      toast("Radio: continuing with similar songs 📻");
      await loadAt(nextIdx, nq);
    } catch (e) {
      await sound.current?.pauseAsync();
    } finally {
      radioBusy.current = false;
    }
  }, [loadAt, toast]);

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
        if (autoplayOn()) { await autoplayExtend(); return; }
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
      if (autoplayOn()) { await autoplayExtend(); return; }
      await sound.current?.pauseAsync();
      return;
    }
    await loadAt(nextIdx, q);
  }, [loadAt, autoplayExtend]);

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

  const clearSleep = useCallback(() => {
    sleepEnd.current = false;
    if (sleepTimer.current) { clearTimeout(sleepTimer.current); sleepTimer.current = null; }
    setSleepArmed(false);
  }, []);

  const sleepMinutes = useCallback((mins: number) => {
    sleepEnd.current = false;
    if (sleepTimer.current) clearTimeout(sleepTimer.current);
    sleepTimer.current = setTimeout(async () => {
      await sound.current?.pauseAsync().catch(() => {});
      clearSleep();
      toast("Sleep timer: music paused 😴");
    }, mins * 60000);
    setSleepArmed(true);
    toast(`Sleep timer: ${mins} min`);
  }, [clearSleep, toast]);

  const sleepEndOfTrack = useCallback(() => {
    if (sleepTimer.current) { clearTimeout(sleepTimer.current); sleepTimer.current = null; }
    sleepEnd.current = true;
    setSleepArmed(true);
    toast("Will pause after this track");
  }, [toast]);

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
    sleepArmed,
    sleepMinutes,
    sleepEndOfTrack,
    clearSleep,
  };
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
