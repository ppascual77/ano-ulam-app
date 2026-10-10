import { useEffect } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { create } from "zustand";
import type { GroceryItem } from "../utils/buildGroceryList";

// Pantry staples the user has moved to "To buy" (they're out of salt, say),
// by grocery item id. Shared by every grocery list, since running out of
// something isn't about one list. A device preference, so AsyncStorage.
const STORAGE_KEY = "anoulam.groceryStaplesToBuy";

type StaplesToBuyState = {
  ids: Set<string>;
  loaded: boolean;
  load: () => Promise<void>;
  toggle: (id: string) => void;
};

export const useStaplesToBuyStore = create<StaplesToBuyState>((set, get) => ({
  ids: new Set(),
  loaded: false,
  load: async () => {
    if (get().loaded) return;
    set({ loaded: true });
    try {
      const raw = await AsyncStorage.getItem(STORAGE_KEY);
      // Merge, so a move made before the load landed isn't lost.
      if (raw) set((s) => ({ ids: new Set([...(JSON.parse(raw) as string[]), ...s.ids]) }));
    } catch {
      // Unreadable: start with none moved.
    }
  },
  toggle: (id) => {
    const ids = new Set(get().ids);
    if (ids.has(id)) ids.delete(id);
    else ids.add(id);
    set({ ids });
    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify([...ids])).catch(() => {});
  },
}));

/** The moved staple ids, loading them on first use. */
export function useStaplesToBuy() {
  const ids = useStaplesToBuyStore((s) => s.ids);
  const load = useStaplesToBuyStore((s) => s.load);
  useEffect(() => {
    void load();
  }, [load]);
  return ids;
}

// Moved staples become "To buy" items: counted in the total and listed with
// the main ingredients, flagged so they can be moved back.
export function applyStaplesToBuy(items: GroceryItem[], ids: Set<string>): GroceryItem[] {
  if (ids.size === 0) return items;
  return items.map((item) =>
    item.category === "pantry" && ids.has(item.id) ? { ...item, category: "main", movedFromStaples: true } : item,
  );
}
