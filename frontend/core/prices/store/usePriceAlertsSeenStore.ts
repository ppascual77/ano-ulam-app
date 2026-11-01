import AsyncStorage from "@react-native-async-storage/async-storage";
import { create } from "zustand";

// Which days' price drop alerts have been seen (opened Price Watch while
// they were showing), so the Price Watch tab's dot only shows for a new day.
// Keyed by DA report date. Kept on the phone: it only decides a dot.
const STORAGE_KEY = "anoulam.seenPriceAlerts";
// Plenty of days; old keys fall off the front.
const MAX_KEYS = 200;

type SeenState = {
  seen: Set<string>;
  loaded: boolean;
  load: () => Promise<void>;
  markSeen: (keys: string[]) => void;
};

export const usePriceAlertsSeenStore = create<SeenState>((set, get) => ({
  seen: new Set(),
  loaded: false,
  load: async () => {
    if (get().loaded) return;
    try {
      const stored = await AsyncStorage.getItem(STORAGE_KEY);
      const keys = stored ? (JSON.parse(stored) as unknown) : [];
      set({ seen: new Set(Array.isArray(keys) ? keys.filter((k): k is string => typeof k === "string") : []), loaded: true });
    } catch {
      set({ loaded: true });
    }
  },
  markSeen: (keys) => {
    const { seen } = get();
    if (keys.every((k) => seen.has(k))) return;
    const next = [...seen, ...keys.filter((k) => !seen.has(k))].slice(-MAX_KEYS);
    set({ seen: new Set(next) });
    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next)).catch(() => {});
  },
}));
