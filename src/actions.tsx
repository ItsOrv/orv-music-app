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
    toast("داره می‌ره تو تلگرام…");
    try { await sendTrack(id); toast("تو تلگرام فرستاده شد ✓"); }
    catch { toast("ارسال نشد"); }
  };

  const addToPlaylistFlow = async (trackId: number) => {
    let pls: Awaited<ReturnType<typeof listPlaylists>> = [];
    try { pls = await listPlaylists(); } catch { toast("خطا در بارگذاری پلی‌لیست‌ها"); return; }
    const actions = pls.map((p) => ({
      label: p.name,
      onPress: async () => {
        try { await addToPlaylist(p.id, trackId); toast(`اضافه شد به «${p.name}»`); }
        catch { toast("اضافه نشد"); }
      },
    }));
    actions.push({
      label: "پلی‌لیستِ جدید…",
      onPress: async () => {
        const n = await prompt("پلی‌لیستِ جدید", "اسمِ پلی‌لیست");
        if (!n) return;
        try { const p = await createPlaylist(n); await addToPlaylist(p.id, trackId); toast(`اضافه شد به «${n}»`); }
        catch { toast("ساخته نشد"); }
      },
    });
    openSheet("افزودن به پلی‌لیست", actions);
  };

  const confirmDelete = (id: number, onDone: () => void) => {
    Alert.alert("حذف آهنگ", "آهنگ کامل از کتابخونه حذف بشه؟", [
      { text: "انصراف", style: "cancel" },
      { text: "حذف", style: "destructive", onPress: async () => { try { await deleteTrack(id); onDone(); } catch { toast("حذف نشد"); } } },
    ]);
  };

  // ⋯ menu for a library row
  const libraryRowMenu = (track: Track, onDeleted: () => void) => {
    if (track.id == null) return;
    const id = track.id;
    openSheet("چی‌کار کنم؟", [
      { label: "بفرست به تلگرام (پخشِ آفلاین)", onPress: () => send(id) },
      { label: "افزودن به پلی‌لیست", onPress: () => addToPlaylistFlow(id) },
      { label: "حذفِ آهنگ", danger: true, onPress: () => confirmDelete(id, onDeleted) },
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
    openSheet(`${track.title || "بی‌نام"}`, [
      { label: "افزودن به کتابخونه", onPress: async () => { try { await ensureInLibrary(track); toast("به کتابخونه اضافه شد ✓"); } catch { toast("اضافه نشد"); } } },
      { label: "بفرست به تلگرام", onPress: async () => { try { const id = await ensureInLibrary(track); if (id) await send(id); } catch { toast("انجام نشد"); } } },
      { label: "افزودن به پلی‌لیست", onPress: async () => { try { const id = await ensureInLibrary(track); if (id) await addToPlaylistFlow(id); } catch { toast("انجام نشد"); } } },
    ]);
  };

  // save a community track into the library
  const saveCommunity = async (track: Track) => {
    try { await communitySave(track.id as number); toast("به کتابخونه اضافه شد ✓"); }
    catch { toast("ذخیره نشد"); }
  };

  return { send, addToPlaylistFlow, confirmDelete, libraryRowMenu, ensureInLibrary, exploreRowMenu, saveCommunity };
}
