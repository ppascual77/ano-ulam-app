import { create } from "zustand";
import type { Session } from "@supabase/supabase-js";

type AuthStore = {
  session: Session | null;
  loading: boolean;
  setSession: (session: Session | null) => void;
  setLoading: (loading: boolean) => void;
};

// Session changes are event-driven (supabase.auth.onAuthStateChange), which
// fits a store better than a query hook. Initialized once in app/_layout.tsx.
export const useAuthStore = create<AuthStore>((set) => ({
  session: null,
  loading: true,
  setSession: (session) => set({ session }),
  setLoading: (loading) => set({ loading }),
}));
