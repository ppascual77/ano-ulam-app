import { useEffect } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { create } from "zustand";

// A new user's first steps, on this phone: the budget picked in onboarding
// (Home's "Start here" card shows meals for it), whether they've done their
// first real thing yet (opened a meal, saved one, made a plan: until then
// Home leads with that card instead of the plan card), and one-time hints
// already shown.
const STORAGE_KEY = "anoulam.firstRun";

export type TonightBudget = { budget: string; servings: number };

type Saved = {
  /** Onboarding's budget for one meal. */
  tonight: TonightBudget | null;
  /** Home's spotlight on By Budget / By Pantry has played. */
  modeTourShown: boolean;
  /** Past the first step: Home shows the plan card again. */
  done: boolean;
  /** Ticked a grocery item once: the list's how-it-works line goes. */
  tickLearned: boolean;
  /** "Like it? Save it..." shown after the first meal opened from Home. */
  saveHintShown: boolean;
};

type FirstRunState = Saved & {
  loaded: boolean;
  /** Tonight's card has its meal sheet open: Home keeps the card until it
   *  closes (not saved). */
  tonightSheetOpen: boolean;
  load: () => Promise<void>;
  setTonight: (tonight: TonightBudget) => void;
  markModeTourShown: () => void;
  markDone: () => void;
  markTickLearned: () => void;
  markSaveHintShown: () => void;
  setTonightSheetOpen: (open: boolean) => void;
};

const EMPTY: Saved = { tonight: null, modeTourShown: false, done: false, tickLearned: false, saveHintShown: false };

export const useFirstRunStore = create<FirstRunState>((set, get) => {
  const save = () => {
    const { tonight, modeTourShown, done, tickLearned, saveHintShown } = get();
    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify({ tonight, modeTourShown, done, tickLearned, saveHintShown })).catch(() => {});
  };
  const patch = (next: Partial<Saved>) => {
    set(next);
    save();
  };
  return {
    ...EMPTY,
    loaded: false,
    tonightSheetOpen: false,
    load: async () => {
      if (get().loaded) return;
      try {
        const raw = await AsyncStorage.getItem(STORAGE_KEY);
        const saved = raw ? (JSON.parse(raw) as Partial<Saved>) : {};
        const tonight = saved.tonight && typeof saved.tonight.budget === "string" && typeof saved.tonight.servings === "number" ? saved.tonight : null;
        // Merged, so a step taken before the load landed isn't lost.
        set((s) => ({
          tonight: s.tonight ?? tonight,
          modeTourShown: s.modeTourShown || saved.modeTourShown === true,
          done: s.done || saved.done === true,
          tickLearned: s.tickLearned || saved.tickLearned === true,
          saveHintShown: s.saveHintShown || saved.saveHintShown === true,
        }));
      } catch {
        // Unreadable: start fresh.
      }
      set({ loaded: true });
    },
    setTonight: (tonight) => patch({ tonight, done: false }),
    markModeTourShown: () => patch({ modeTourShown: true }),
    markDone: () => {
      if (!get().done) patch({ done: true });
    },
    markTickLearned: () => {
      if (!get().tickLearned) patch({ tickLearned: true });
    },
    markSaveHintShown: () => patch({ saveHintShown: true }),
    setTonightSheetOpen: (open) => set({ tonightSheetOpen: open }),
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
