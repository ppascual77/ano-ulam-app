import { create } from "zustand";

/** "signingIn": the Apple/Google sheet said yes and the app is finishing
 *  the sign-in (session, then e.g. onboarding's preferences).
 *  "loggingOut": signing out and heading back Home. */
export type AuthActivity = "signingIn" | "loggingOut";

type AuthActivityStore = {
  /** What AuthActivityOverlay is covering the app for; null: nothing. */
  activity: AuthActivity | null;
  setActivity: (activity: AuthActivity | null) => void;
};

// Event-driven (set from inside a sign-in or log-out, read by one app-wide
// overlay), so a store rather than a query.
export const useAuthActivityStore = create<AuthActivityStore>((set) => ({
  activity: null,
  setActivity: (activity) => set({ activity }),
}));
