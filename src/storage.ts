import { Platform } from "react-native";
import * as SecureStore from "expo-secure-store";

// SecureStore on native; localStorage on web (SecureStore has no web support).
export async function storageGet(key: string): Promise<string | null> {
  if (Platform.OS === "web") {
    try { return globalThis.localStorage?.getItem(key) ?? null; } catch { return null; }
  }
  return SecureStore.getItemAsync(key);
}

export async function storageSet(key: string, value: string): Promise<void> {
  if (Platform.OS === "web") {
    try { globalThis.localStorage?.setItem(key, value); } catch {}
    return;
  }
  await SecureStore.setItemAsync(key, value);
}

export async function storageDelete(key: string): Promise<void> {
  if (Platform.OS === "web") {
    try { globalThis.localStorage?.removeItem(key); } catch {}
    return;
  }
  await SecureStore.deleteItemAsync(key);
}
