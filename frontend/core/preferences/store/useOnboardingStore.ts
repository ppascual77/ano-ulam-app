import AsyncStorage from "@react-native-async-storage/async-storage";
import { create } from "zustand";

// Onboarding runs once per phone: after finishing it (signed in, or
// "continue without an account"), the app opens straight to Home on every
// launch, the same as for a signed-in user, even after signing out. A
// device setting, so AsyncStorage (gone with a reinstall, like any first
// run). app/_layout.tsx loads it before the first screen renders, so the
// Intro screen never flashes Get Started for someone who's been through it.
const STORAGE_KEY = "anoulam.onboardingDone";

type OnboardingState = {
  done: boolean;
  loaded: boolean;
  load: () => Promise<void>;
  markDone: () => void;
};

export const useOnboardingStore = create<OnboardingState>((set) => ({
  done: false,
  loaded: false,
  load: async () => {
    try {
      set({ done: (await AsyncStorage.getItem(STORAGE_KEY)) === "1", loaded: true });
    } catch {
      // Unreadable: show onboarding (the safe default for a first run).
      set({ loaded: true });
    }
  },
  markDone: () => {
    set({ done: true });
    AsyncStorage.setItem(STORAGE_KEY, "1").catch(() => {});
  },
}));
