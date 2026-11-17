import { useEffect } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { create } from "zustand";

// Which planned meals were finished through Start Cooking (so the morning
// nudge doesn't ask about them again), and how the nudge was last answered.
// A device record, like the other small Home preferences, kept two weeks.
const STORAGE_KEY = "anoulam.pantryCooked";
const KEEP_DAYS = 14;

/** A local calendar day, "2026-11-18". */
export const dayKey = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;

type Saved = {
  /** "<day>|<mealId>" for each meal cooked through Start Cooking. */
  cooked: string[];
  /** The day the nudge was last answered (Update or Skip): once a day. */
  answeredDay: string | null;
  /** Skips in a row; at 3 the nudge waits a week (see useMorningNudge). */
  skipStreak: number;
};

type CookedState = Saved & {
  loaded: boolean;
  load: () => Promise<void>;
  markCooked: (mealId: string, date?: Date) => void;
  answer: (skipped: boolean) => void;
};

const EMPTY: Saved = { cooked: [], answeredDay: null, skipStreak: 0 };

function save(state: Saved) {
  AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(state)).catch(() => {});
}

export const useCookedStore = create<CookedState>((set, get) => ({
  ...EMPTY,
  loaded: false,
  load: async () => {
    if (get().loaded) return;
    set({ loaded: true });
    try {
      const raw = await AsyncStorage.getItem(STORAGE_KEY);
      if (raw) {
        const saved = { ...EMPTY, ...(JSON.parse(raw) as Partial<Saved>) };
        // Merged, so a meal cooked before the load landed isn't lost.
        set((s) => ({ ...saved, cooked: [...new Set([...saved.cooked, ...s.cooked])] }));
      }
    } catch {
      // Unreadable: start fresh.
    }
  },
  markCooked: (mealId, date = new Date()) => {
    const cutoff = dayKey(new Date(Date.now() - KEEP_DAYS * 86_400_000));
    const cooked = [...new Set([...get().cooked, `${dayKey(date)}|${mealId}`])].filter((entry) => entry.slice(0, 10) >= cutoff);
    set({ cooked });
    const { answeredDay, skipStreak } = get();
    save({ cooked, answeredDay, skipStreak });
  },
  answer: (skipped) => {
    const answeredDay = dayKey(new Date());
    const skipStreak = skipped ? get().skipStreak + 1 : 0;
    set({ answeredDay, skipStreak });
    save({ cooked: get().cooked, answeredDay, skipStreak });
  },
}));

/** The store, loaded on first use. */
export function useCooked() {
  const state = useCookedStore();
  useEffect(() => {
    void state.load();
  }, [state.load]);
  return state;
}
