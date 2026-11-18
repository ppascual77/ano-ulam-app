import { useEffect } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { create } from "zustand";
import type { PantryIngredient } from "../types";

// Home's pantry upkeep, as a device record (like the other small Home
// preferences): when the saved-meals nudge was last answered and how many
// skips in a row, the last meal plan day whose ingredients were taken out
// of the pantry, and the note saying what went (Home's header line).
const STORAGE_KEY = "anoulam.pantryNudge";

/** A local calendar day, "2026-11-18". Sorts and compares as text. */
export const dayKey = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;

/** What a plan day's cleanup took out, for Home's header line and its
 *  Undo. Shown for 12 hours (CLEANUP_NOTE_MS) unless undone first.
 *  `when`: "Tuesday's plan", or "Your past plan days" for several.
 *  `planStart`: the start date of the plan it came from, so a new plan
 *  doesn't show the old one's note (missing on notes from before this). */
export type CleanupNote = { when: string; items: PantryIngredient[]; at: number; planStart?: string };
export const CLEANUP_NOTE_MS = 12 * 60 * 60 * 1000;

/** Whole days from one day key to another. */
export const daysBetween = (from: string, to: string) => Math.round((new Date(to).getTime() - new Date(from).getTime()) / 86_400_000);

type Saved = {
  /** The day the nudge was last answered (Update or Skip): once a day. */
  answeredDay: string | null;
  /** Skips in a row; at 3 the nudge asks every 3 days (see useMorningNudge). */
  skipStreak: number;
  /** The latest plan day already cleaned out of the pantry. */
  cleanedThrough: string | null;
  cleanupNote: CleanupNote | null;
};

type NudgeState = Saved & {
  loaded: boolean;
  load: () => Promise<void>;
  answer: (skipped: boolean) => void;
  markCleaned: (day: string) => void;
  setCleanupNote: (note: CleanupNote | null) => void;
};

const EMPTY: Saved = { answeredDay: null, skipStreak: 0, cleanedThrough: null, cleanupNote: null };

const isNote = (v: unknown): v is CleanupNote =>
  !!v && typeof v === "object" && typeof (v as CleanupNote).when === "string" && typeof (v as CleanupNote).at === "number" && Array.isArray((v as CleanupNote).items);

export const useNudgeStore = create<NudgeState>((set, get) => {
  const save = () => {
    const { answeredDay, skipStreak, cleanedThrough, cleanupNote } = get();
    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify({ answeredDay, skipStreak, cleanedThrough, cleanupNote })).catch(() => {});
  };
  return {
    ...EMPTY,
    loaded: false,
    load: async () => {
      if (get().loaded) return;
      try {
        const raw = await AsyncStorage.getItem(STORAGE_KEY);
        const saved = raw ? (JSON.parse(raw) as Partial<Saved>) : {};
        set({
          answeredDay: typeof saved.answeredDay === "string" ? saved.answeredDay : null,
          skipStreak: typeof saved.skipStreak === "number" ? saved.skipStreak : 0,
          cleanedThrough: typeof saved.cleanedThrough === "string" ? saved.cleanedThrough : null,
          cleanupNote: isNote(saved.cleanupNote) ? saved.cleanupNote : null,
        });
      } catch {
        // Unreadable: start fresh.
      }
      set({ loaded: true });
    },
    answer: (skipped) => {
      set({ answeredDay: dayKey(new Date()), skipStreak: skipped ? get().skipStreak + 1 : 0 });
      save();
    },
    markCleaned: (day) => {
      set({ cleanedThrough: day });
      save();
    },
    setCleanupNote: (note) => {
      set({ cleanupNote: note });
      save();
    },
  };
});

/** The store, loaded on first use. */
export function useNudge() {
  const state = useNudgeStore();
  useEffect(() => {
    void state.load();
  }, [state.load]);
  return state;
}
