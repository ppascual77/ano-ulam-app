import { useEffect } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { create } from "zustand";

// A new user's first steps, on this phone: whether they came through
// onboarding here (Home's one-time hints are for them), and one-time hints
// already shown.
const STORAGE_KEY = "anoulam.firstRun";

type Saved = {
  /** Finished onboarding on this phone: a new user. */
  onboarded: boolean;
  /** Home's spotlight on By Budget / By Pantry has played. */
  modeTourShown: boolean;
  /** Ticked a grocery item once: the list's how-it-works line goes. */
  tickLearned: boolean;
  /** Cook mode opens that showed the "Tap to hear each step read aloud"
   *  nudge (it shows on the first 3). */
  narrationNudges: number;
  /** Turned narration on once: the nudge is done for good. */
  narrationUsed: boolean;
};

type FirstRunState = Saved & {
  loaded: boolean;
  load: () => Promise<void>;
  markOnboarded: () => void;
  markModeTourShown: () => void;
  markTickLearned: () => void;
  markNarrationNudged: () => void;
  markNarrationUsed: () => void;
};

const EMPTY: Saved = { onboarded: false, modeTourShown: false, tickLearned: false, narrationNudges: 0, narrationUsed: false };

export const useFirstRunStore = create<FirstRunState>((set, get) => {
  const save = () => {
    const { onboarded, modeTourShown, tickLearned, narrationNudges, narrationUsed } = get();
    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify({ onboarded, modeTourShown, tickLearned, narrationNudges, narrationUsed })).catch(() => {});
  };
  const patch = (next: Partial<Saved>) => {
    set(next);
    save();
  };
  return {
    ...EMPTY,
    loaded: false,
    load: async () => {
      if (get().loaded) return;
      try {
        const raw = await AsyncStorage.getItem(STORAGE_KEY);
        const saved = raw ? (JSON.parse(raw) as Partial<Saved> & { tonight?: unknown }) : {};
        // Merged, so a step taken before the load landed isn't lost. An
        // older save's onboarding budget (`tonight`) also means onboarded.
        set((s) => ({
          onboarded: s.onboarded || saved.onboarded === true || !!saved.tonight,
          modeTourShown: s.modeTourShown || saved.modeTourShown === true,
          tickLearned: s.tickLearned || saved.tickLearned === true,
          narrationNudges: Math.max(s.narrationNudges, typeof saved.narrationNudges === "number" ? saved.narrationNudges : 0),
          narrationUsed: s.narrationUsed || saved.narrationUsed === true,
        }));
      } catch {
        // Unreadable: start fresh.
      }
      set({ loaded: true });
    },
    markOnboarded: () => patch({ onboarded: true }),
    markModeTourShown: () => patch({ modeTourShown: true }),
    markTickLearned: () => {
      if (!get().tickLearned) patch({ tickLearned: true });
    },
    markNarrationNudged: () => patch({ narrationNudges: get().narrationNudges + 1 }),
    markNarrationUsed: () => {
      if (!get().narrationUsed) patch({ narrationUsed: true });
    },
  };
});

/** The store, loaded on first use. */
export function useFirstRun() {
  const state = useFirstRunStore();
  useEffect(() => {
    void state.load();
  }, [state.load]);
  return state;
}
