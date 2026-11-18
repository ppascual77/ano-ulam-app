import { useEffect } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { create } from "zustand";

// Cook mode's speaker button: whether the steps are read aloud. Off until
// someone turns it on, then remembered on this phone for the next meal (a
// device setting, like Surprise me, not account data).
const STORAGE_KEY = "anoulam.narrateSteps";

type NarrationState = {
  on: boolean;
  loaded: boolean;
  load: () => Promise<void>;
  setOn: (on: boolean) => void;
};

export const useNarrationStore = create<NarrationState>((set, get) => ({
  on: false,
  loaded: false,
  load: async () => {
    if (get().loaded) return;
    try {
      const stored = await AsyncStorage.getItem(STORAGE_KEY);
      if (stored != null) set({ on: stored === "1" });
    } catch {
      // Unreadable: keep the default (off).
    }
    set({ loaded: true });
  },
  setOn: (on) => {
    set({ on });
    AsyncStorage.setItem(STORAGE_KEY, on ? "1" : "0").catch(() => {});
  },
}));

/** The setting, loaded on first use. */
export function useNarration() {
  const state = useNarrationStore();
  useEffect(() => {
    void state.load();
  }, [state.load]);
  return state;
}
