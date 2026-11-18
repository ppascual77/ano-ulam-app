import { useEffect } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { create } from "zustand";

// A new user's first steps, on this phone: the budget picked in onboarding
// (Home opens with it in the budget form, suggested), and one-time hints
// already shown.
const STORAGE_KEY = "anoulam.firstRun";

export type TonightBudget = { budget: string; servings: number };

type Saved = {
  /** Onboarding's budget for one meal. */
  tonight: TonightBudget | null;
  /** Home still has to put the budget in its form and suggest (once). */
  prefillPending: boolean;
  /** Home's spotlight on By Budget / By Pantry has played. */
  modeTourShown: boolean;
  /** Ticked a grocery item once: the list's how-it-works line goes. */
  tickLearned: boolean;
};

type FirstRunState = Saved & {
  loaded: boolean;
  load: () => Promise<void>;
  setTonight: (tonight: TonightBudget) => void;
  clearPrefill: () => void;
  markModeTourShown: () => void;
  markTickLearned: () => void;
};

const EMPTY: Saved = { tonight: null, prefillPending: false, modeTourShown: false, tickLearned: false };

export const useFirstRunStore = create<FirstRunState>((set, get) => {
  const save = () => {
    const { tonight, prefillPending, modeTourShown, tickLearned } = get();
    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify({ tonight, prefillPending, modeTourShown, tickLearned })).catch(() => {});
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
        const saved = raw ? (JSON.parse(raw) as Partial<Saved>) : {};
        const tonight = saved.tonight && typeof saved.tonight.budget === "string" && typeof saved.tonight.servings === "number" ? saved.tonight : null;
        // Merged, so a step taken before the load landed isn't lost.
        set((s) => ({
          tonight: s.tonight ?? tonight,
          prefillPending: s.prefillPending || saved.prefillPending === true,
          modeTourShown: s.modeTourShown || saved.modeTourShown === true,
          tickLearned: s.tickLearned || saved.tickLearned === true,
        }));
      } catch {
        // Unreadable: start fresh.
      }
      set({ loaded: true });
    },
    setTonight: (tonight) => patch({ tonight, prefillPending: true }),
    clearPrefill: () => patch({ prefillPending: false }),
    markModeTourShown: () => patch({ modeTourShown: true }),
    markTickLearned: () => {
      if (!get().tickLearned) patch({ tickLearned: true });
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
