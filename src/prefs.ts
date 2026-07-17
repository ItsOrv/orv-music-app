import AsyncStorage from "@react-native-async-storage/async-storage";

const AUTOPLAY_KEY = "orv_autoplay";
let autoplayCache = true;

export async function initPrefs(): Promise<void> {
  try { autoplayCache = (await AsyncStorage.getItem(AUTOPLAY_KEY)) !== "0"; } catch {}
}

export function autoplayOn(): boolean {
  return autoplayCache;
}

export async function setAutoplay(on: boolean): Promise<void> {
  autoplayCache = on;
  try { await AsyncStorage.setItem(AUTOPLAY_KEY, on ? "1" : "0"); } catch {}
}
