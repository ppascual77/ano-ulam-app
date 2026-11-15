import { useEffect } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { create } from "zustand";

// Which saved meals are on the saved-meals grocery list. Saving is a
// bookmark, not "cooking this week", so the list only adds up the meals the
// user picked (the photo row at the top of the sheet). Stored as the meals
// turned OFF, by saved_id: a new save is on the list until switched off.
// Switched back on by hand only (a meal whose ingredients are all picked up
// just shows as ready). A device preference per account, so AsyncStorage.
const storageKey = (userId: string | null) => `anoulam.groceryMealsOff.${userId ?? "guest"}`;

type GroceryMealsState = {
  off: Set<string>;
  /** The account whose choices are loaded. */
  loadedFor: string | null | undefined;
  load: (userId: string | null) => Promise<void>;
  toggle: (userId: string | null, savedId: string) => void;
};

export const useGroceryMealsStore = create<GroceryMealsState>((set, get) => ({
  off: new Set(),
  loadedFor: undefined,
  load: async (userId) => {
    if (get().loadedFor === userId) return;
    set({ loadedFor: userId, off: new Set() });
    try {
      const raw = await AsyncStorage.getItem(storageKey(userId));
      // Merge, so a toggle made before the load landed isn't lost.
      if (raw && get().loadedFor === userId) set((s) => ({ off: new Set([...(JSON.parse(raw) as string[]), ...s.off]) }));
    } catch {
      // Unreadable: every meal on.
    }
  },
  toggle: (userId, savedId) => {
    const off = new Set(get().off);
    if (off.has(savedId)) off.delete(savedId);
    else off.add(savedId);
    set({ off });
    AsyncStorage.setItem(storageKey(userId), JSON.stringify([...off])).catch(() => {});
  },
}));

/** The saved meals switched off the grocery list, loading them on first use. */
export function useGroceryMealsOff(userId: string | null) {
  const off = useGroceryMealsStore((s) => s.off);
  const load = useGroceryMealsStore((s) => s.load);
  useEffect(() => {
    void load(userId);
  }, [load, userId]);
  return off;
}
