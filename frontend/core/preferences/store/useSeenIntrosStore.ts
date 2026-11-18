import AsyncStorage from "@react-native-async-storage/async-storage";
import { create } from "zustand";
import { getSeenIntros, setSeenIntros } from "@/api/auth";

// Page intros (Browse, Price Watch, Discover, Meal Planner) play once: the
// first visit to each page. Remembered per account (users.seen_intros) when
// signed in, and on the phone either way (a guest's only copy; signing in
// merges it into the account). Dev builds remember too (Settings' "Replay
// page intros" plays them again). Finishing, skipping or leaving mid-intro
// all count as seen.
const STORAGE_KEY = "anoulam.seenIntros";

export type IntroId = "browse" | "price-watch" | "discover" | "meal-planner";

type SeenIntrosState = {
  seen: Set<IntroId>;
  /** The phone's copy has been read, and the account's too (when signed
   *  in), so an intro that's been seen anywhere never starts. */
  loaded: boolean;
  phoneLoaded: boolean;
  accountReady: boolean;
  userId: string | null;
  load: () => Promise<void>;
  /** The signed-in account (null: signed out). Reads its seen intros and
   *  merges in the phone's (saving the union back). */
  syncAccount: (userId: string | null) => Promise<void>;
  markSeen: (id: IntroId) => void;
  /** Settings' "Replay page intros": the phone and the account. */
  reset: () => void;
};

const persistPhone = (seen: Set<IntroId>) => AsyncStorage.setItem(STORAGE_KEY, JSON.stringify([...seen])).catch(() => {});

export const useSeenIntrosStore = create<SeenIntrosState>((set, get) => {
  const settle = () => set({ loaded: get().phoneLoaded && get().accountReady });
  return {
    seen: new Set(),
    loaded: false,
    phoneLoaded: false,
    accountReady: false,
    userId: null,
    load: async () => {
      try {
        const raw = await AsyncStorage.getItem(STORAGE_KEY);
        if (raw) set({ seen: new Set([...get().seen, ...(JSON.parse(raw) as IntroId[])]) });
      } catch {
        // Unreadable: the intros just play again.
      } finally {
        set({ phoneLoaded: true });
        settle();
      }
    },
    syncAccount: async (userId) => {
      set({ userId, accountReady: !userId });
      settle();
      if (!userId) return;
      try {
        const account = (await getSeenIntros(userId)) as IntroId[];
        if (get().userId !== userId) return;
        const seen = new Set([...get().seen, ...account]);
        set({ seen });
        persistPhone(seen);
        // The phone saw some the account didn't (e.g. as a guest): save them.
        if (seen.size > account.length) void setSeenIntros(userId, [...seen]).catch(() => {});
      } catch {
        // Unreachable: the phone's copy decides for now.
      } finally {
        if (get().userId === userId) {
          set({ accountReady: true });
          settle();
        }
      }
    },
    markSeen: (id) => {
      if (get().seen.has(id)) return;
      const seen = new Set(get().seen).add(id);
      set({ seen });
      persistPhone(seen);
      const { userId } = get();
      if (userId) void setSeenIntros(userId, [...seen]).catch(() => {});
    },
    reset: () => {
      set({ seen: new Set() });
      AsyncStorage.removeItem(STORAGE_KEY).catch(() => {});
      const { userId } = get();
      if (userId) void setSeenIntros(userId, []).catch(() => {});
    },
  };
});

/** Whether this page's intro is still due (loaded and not seen yet), and
 *  how to mark it seen. Not due until the seen list has loaded, so an
 *  already-seen intro never starts. */
export function useIntroOnce(id: IntroId) {
  const due = useSeenIntrosStore((s) => s.loaded && !s.seen.has(id));
  const markSeen = useSeenIntrosStore((s) => s.markSeen);
  return { due, markSeen: () => markSeen(id) };
}
