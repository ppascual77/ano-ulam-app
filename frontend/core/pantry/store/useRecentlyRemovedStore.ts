import AsyncStorage from "@react-native-async-storage/async-storage";
import { create } from "zustand";
import type { PantryIngredient } from "../types";

// Pantry ingredients the user removed lately, newest first, offered back as
// one-tap adds in the Add Ingredients sheet ("Recently removed"). A device
// convenience, not account data, so it lives in AsyncStorage.
const STORAGE_KEY = "anoulam.pantryRecentlyRemoved";
const KEEP = 8;

type RecentlyRemovedState = {
  items: PantryIngredient[];
  loaded: boolean;
  load: () => Promise<void>;
  record: (item: PantryIngredient) => void;
};

export const useRecentlyRemovedStore = create<RecentlyRemovedState>((set, get) => ({
  items: [],
  loaded: false,
  load: async () => {
    if (get().loaded) return;
    try {
      const raw = await AsyncStorage.getItem(STORAGE_KEY);
      // Anything recorded before the load finished stays in front.
      const stored = raw ? (JSON.parse(raw) as PantryIngredient[]) : [];
      const current = get().items;
      set({ items: [...current, ...stored.filter((s) => !current.some((c) => c.id === s.id))].slice(0, KEEP), loaded: true });
    } catch {
      set({ loaded: true });
    }
  },
  record: (item) => {
    const items = [item, ...get().items.filter((i) => i.id !== item.id)].slice(0, KEEP);
    set({ items });
    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(items)).catch(() => {});
  },
}));
