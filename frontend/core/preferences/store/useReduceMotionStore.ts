import AsyncStorage from "@react-native-async-storage/async-storage";
import { useReducedMotion } from "react-native-reanimated";
import { create } from "zustand";

// Profile > Settings > Accessibility > "Reduce motion". A device setting,
// not account data, so it lives in AsyncStorage. null = never touched:
// follow the phone's own accessibility setting.
const STORAGE_KEY = "anoulam.reduceMotion";

type ReduceMotionState = {
  override: boolean | null;
  load: () => Promise<void>;
  setReduceMotion: (on: boolean) => void;
};

export const useReduceMotionStore = create<ReduceMotionState>((set) => ({
  override: null,
  load: async () => {
    try {
      const stored = await AsyncStorage.getItem(STORAGE_KEY);
      set({ override: stored == null ? null : stored === "1" });
    } catch {
      // Unreadable: keep following the phone's setting.
    }
  },
  setReduceMotion: (on) => {
    set({ override: on });
    AsyncStorage.setItem(STORAGE_KEY, on ? "1" : "0").catch(() => {});
  },
}));

/** Whether to cut motion: the user's choice in Settings, else the phone's. */
export function useReduceMotion() {
  const system = useReducedMotion();
  const override = useReduceMotionStore((s) => s.override);
  return override ?? system;
}
