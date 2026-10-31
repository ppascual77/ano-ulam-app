import AsyncStorage from "@react-native-async-storage/async-storage";
import { create } from "zustand";

// Discover's "Your recipe could earn you Pro" sheet: at most once a day, and
// never again after it's been dismissed MAX_DISMISSALS times. Remembered on
// the device, like the page intros.
const STORAGE_KEY = "anoulam.earnProPrompt";
const MAX_DISMISSALS = 3;

type Saved = { lastShownDay: string | null; dismissals: number };

type EarnProPromptState = Saved & {
  loaded: boolean;
  load: () => Promise<void>;
  markShown: () => void;
  /** Closed without picking an action. */
  markDismissed: () => void;
};

// The local calendar day, so "once a day" follows the user's own midnight.
function today() {
  const d = new Date();
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
}

function persist(saved: Saved) {
  AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(saved)).catch(() => {});
}

export const useEarnProPromptStore = create<EarnProPromptState>((set, get) => ({
  lastShownDay: null,
  dismissals: 0,
  loaded: false,
  load: async () => {
    if (get().loaded) return;
    try {
      const raw = await AsyncStorage.getItem(STORAGE_KEY);
      if (raw) set(JSON.parse(raw) as Saved);
    } catch {
      // Unreadable: it may show again, which is harmless.
    } finally {
      set({ loaded: true });
    }
  },
  markShown: () => {
    set({ lastShownDay: today() });
    persist({ lastShownDay: get().lastShownDay, dismissals: get().dismissals });
  },
  markDismissed: () => {
    set({ dismissals: get().dismissals + 1 });
    persist({ lastShownDay: get().lastShownDay, dismissals: get().dismissals });
  },
}));

/** Whether the sheet may show now (loaded, not shown today, not given up). */
export function canShowEarnProPrompt() {
  const { loaded, lastShownDay, dismissals } = useEarnProPromptStore.getState();
  return loaded && lastShownDay !== today() && dismissals < MAX_DISMISSALS;
}
