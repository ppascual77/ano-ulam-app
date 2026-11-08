import { create } from "zustand";
import type { MealType } from "@/frontend/core/meals/mealTypes";
import type { LoginGateReason } from "../components/LoginGateSheet";

type LoginGateStore = {
  /** The app-wide login sheet's reason; null: closed. */
  reason: LoginGateReason | null;
  /** A guest's save waiting on sign-in: saved as soon as they're in. */
  pendingSave: MealType | null;
  /** Open sheets that show the gate inside themselves (Meal Details): while
   *  any is open, the root copy stays hidden (two native Modals don't
   *  stack reliably). */
  hosts: number;
  open: (reason: LoginGateReason, pendingSave?: MealType) => void;
  /** Signed in: close, keeping the pending save for PendingSaveReplay. */
  close: () => void;
  /** Swiped away without signing in: close and forget the save. */
  dismiss: () => void;
  clearPending: () => void;
  addHost: () => void;
  removeHost: () => void;
};

// The login sheet for actions that need an account, opened from wherever
// they happen (useSavedMealActions for a guest's save) and shown once by
// GlobalLoginGate. Event-driven, so a store rather than a query.
export const useLoginGateStore = create<LoginGateStore>((set) => ({
  reason: null,
  pendingSave: null,
  hosts: 0,
  open: (reason, pendingSave) => set({ reason, pendingSave: pendingSave ?? null }),
  close: () => set({ reason: null }),
  dismiss: () => set({ reason: null, pendingSave: null }),
  clearPending: () => set({ pendingSave: null }),
  addHost: () => set((s) => ({ hosts: s.hosts + 1 })),
  removeHost: () => set((s) => ({ hosts: Math.max(0, s.hosts - 1) })),
}));
