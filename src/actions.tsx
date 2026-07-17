import { Alert } from "react-native";
import {
  Track, sendTrack, deleteTrack, listPlaylists, createPlaylist, addToPlaylist,
  addToLibrary, communitySave,
} from "./api";
import { useSheet } from "./sheet";
import { usePrompt } from "./prompt";
import { useToast } from "./ui";

// Shared actions for a library-owned track (has a numeric id).
export function useTrackActions() {
  const openSheet = useSheet();
  const prompt = usePrompt();
  const toast = useToast();

  const send = async (id: number) => {
    toast("Sending to Telegram…");
    try { await sendTrack(id); toast("Sent to Telegram ✓"); }
    catch { toast("Couldn't send"); }
  };

  const addToPlaylistFlow = async (trackId: number) => {
    let pls: Awaited<ReturnType<typeof listPlaylists>> = [];
    try { pls = await listPlaylists(); } catch { toast("Couldn't load playlists"); return; }
    const actions = pls.map((p) => ({
      label: p.name,
      onPress: async () => {
        try { await addToPlaylist(p.id, trackId); toast(`Added to "${p.name}"`); }
        catch { toast("Couldn't add"); }
      },
    }));
    actions.push({
      label: "New playlist…",
      onPress: async () => {
        const n = await prompt("New playlist", "Playlist name");
        if (!n) return;
        try { const p = await createPlaylist(n); await addToPlaylist(p.id, trackId); toast(`Added to "${n}"`); }
        catch { toast("Couldn't create"); }
      },
    });
    openSheet("Add to playlist", actions);
  };

  const confirmDelete = (id: number, onDone: () => void) => {
    Alert.alert("Delete track", "Remove this track from your library entirely?", [
      { text: "Cancel", style: "cancel" },
      { text: "Delete", style: "destructive", onPress: async () => { try { await deleteTrack(id); onDone(); } catch { toast("Couldn't delete"); } } },
    ]);
  };

  // ⋯ menu for a library row
  const libraryRowMenu = (track: Track, onDeleted: () => void) => {
    if (track.id == null) return;
    const id = track.id;
    openSheet("What do you want to do?", [
      { label: "Send to Telegram (offline playback)", onPress: () => send(id) },
      { label: "Add to playlist", onPress: () => addToPlaylistFlow(id) },
      { label: "Delete track", danger: true, onPress: () => confirmDelete(id, onDeleted) },
    ]);
  };

  // ensure a discover/community track exists in the library, return its id
  const ensureInLibrary = async (track: Track): Promise<number | null> => {
    if (track.id != null && !track.community) return track.id;
    if (track.community) { const r = await communitySave(track.id as number); return r?.id ?? null; }
    return addToLibrary(track);
  };

  // ＋ menu for an explore/discover row (send & playlist auto-add to library first)
  const exploreRowMenu = (track: Track) => {
    openSheet(`${track.title || "Untitled"}`, [
      { label: "Add to library", onPress: async () => { try { await ensureInLibrary(track); toast("Added to library ✓"); } catch { toast("Couldn't add"); } } },
      { label: "Send to Telegram", onPress: async () => { try { const id = await ensureInLibrary(track); if (id) await send(id); } catch { toast("Something went wrong"); } } },
      { label: "Add to playlist", onPress: async () => { try { const id = await ensureInLibrary(track); if (id) await addToPlaylistFlow(id); } catch { toast("Something went wrong"); } } },
    ]);
  };

  // save a community track into the library
  const saveCommunity = async (track: Track) => {
    try { await communitySave(track.id as number); toast("Added to library ✓"); }
    catch { toast("Couldn't save"); }
  };

  return { send, addToPlaylistFlow, confirmDelete, libraryRowMenu, ensureInLibrary, exploreRowMenu, saveCommunity };
}
