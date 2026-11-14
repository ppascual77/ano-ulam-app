import { create } from "zustand";

// Hides the bottom nav (BottomNav) while a full-screen moment covers the
// app, e.g. Home's welcome intro right after onboarding: the intro's cover
// only spans the screen above the nav, so the nav peeked through. Whoever
// hides it shows it again (Home, once the welcome intro has finished).
export const useTabBarStore = create<{ hidden: boolean; setHidden: (hidden: boolean) => void }>((set) => ({
  hidden: false,
  setHidden: (hidden) => set({ hidden }),
}));
