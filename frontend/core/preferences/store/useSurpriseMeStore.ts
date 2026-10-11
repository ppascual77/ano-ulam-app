import AsyncStorage from "@react-native-async-storage/async-storage";
import { create } from "zustand";

// Profile > Settings > Home > "Surprise me": whether Home shows the pull-down
// Surprise me tag (RandomMealPuller). A device setting, not account data,
// so it lives in AsyncStorage. On by default.
const STORAGE_KEY = "anoulam.showSurpriseMe";

type SurpriseMeState = {
  show: boolean;
  load: () => Promise<void>;
  setShow: (show: boolean) => void;
};

export const useSurpriseMeStore = create<SurpriseMeState>((set) => ({
  show: true,
  load: async () => {
    try {
      const stored = await AsyncStorage.getItem(STORAGE_KEY);
      if (stored != null) set({ show: stored === "1" });
    } catch {
      // Unreadable: keep the default (shown).
    }
  },
  setShow: (show) => {
    set({ show });
    AsyncStorage.setItem(STORAGE_KEY, show ? "1" : "0").catch(() => {});
  },
}));
