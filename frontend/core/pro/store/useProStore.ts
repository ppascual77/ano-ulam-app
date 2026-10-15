import { create } from "zustand";

// MOCK Pro status: no subscriptions yet. "Unlock" flips this for testing and
// it resets on reload. Shared by every Pro gate (the Meal Planner's locked
// days, the grocery list's plan days, Settings' Pro section), so swapping in
// a real entitlement later is one place.
type ProStore = {
  isPro: boolean;
  setPro: (isPro: boolean) => void;
};

export const useProStore = create<ProStore>((set) => ({
  isPro: false,
  setPro: (isPro) => set({ isPro }),
}));

export const useIsPro = () => useProStore((s) => s.isPro);
