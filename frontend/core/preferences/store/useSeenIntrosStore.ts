import AsyncStorage from "@react-native-async-storage/async-storage";
import { create } from "zustand";

// Page intros (Browse, Price Watch, Discover, Meal Planner) play once: the
// first visit to each page. Remembered on the device, like other device
// preferences. Finishing or skipping counts as seen; leaving mid-intro
// doesn't (it plays again next visit).
const STORAGE_KEY = "anoulam.seenIntros";

export type IntroId = "browse" | "price-watch" | "discover" | "meal-planner";

type SeenIntrosState = {
  seen: Set<IntroId>;
  loaded: boolean;
  load: () => Promise<void>;
  markSeen: (id: IntroId) => void;
  /** Settings' "Replay page intros". */
  reset: () => void;
};

export const useSeenIntrosStore = create<SeenIntrosState>((set, get) => ({
  seen: new Set(),
  loaded: false,
  load: async () => {
    // Dev builds forget on every reload, so the intros can be checked again
    // without "Replay page intros". Each still plays only once per session.
    if (__DEV__) {
      set({ loaded: true });
      return;
    }
    try {
      const raw = await AsyncStorage.getItem(STORAGE_KEY);
      if (raw) set({ seen: new Set(JSON.parse(raw) as IntroId[]) });
    } catch {
      // Unreadable: the intros just play again.
    } finally {
      set({ loaded: true });
    }
  },
  markSeen: (id) => {
    if (get().seen.has(id)) return;
    const seen = new Set(get().seen).add(id);
    set({ seen });
    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify([...seen])).catch(() => {});
  },
  reset: () => {
    set({ seen: new Set() });
    AsyncStorage.removeItem(STORAGE_KEY).catch(() => {});
  },
}));

/** Whether this page's intro is still due (loaded and not seen yet), and
 *  how to mark it seen. Not due until the seen list has loaded, so an
 *  already-seen intro never starts. */
export function useIntroOnce(id: IntroId) {
  const due = useSeenIntrosStore((s) => s.loaded && !s.seen.has(id));
  const markSeen = useSeenIntrosStore((s) => s.markSeen);
  return { due, markSeen: () => markSeen(id) };
}
