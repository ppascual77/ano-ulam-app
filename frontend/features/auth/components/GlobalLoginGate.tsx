import { useEffect } from "react";
import { useSavedMealActions } from "@/frontend/core/saved/hooks/useSavedMeals";
import { useAuth, useSignIn, type SignInProvider } from "../hooks/useAuth";
import { useLoginGateStore } from "../store/useLoginGateStore";
import { LoginGateSheet } from "./LoginGateSheet";

// The app-wide login sheet (useLoginGateStore): a guest saving a meal from
// any screen lands here instead of on a failed request. Mounted once in
// app/_layout.tsx; sheets that open over the app (Meal Details) render
// their own `presentation="inline"` copy in their overlay while open, and
// the root copy steps aside.
export function GlobalLoginGate({ presentation = "modal" }: { presentation?: "modal" | "inline" }) {
  const reason = useLoginGateStore((s) => s.reason);
  const hosts = useLoginGateStore((s) => s.hosts);
  const close = useLoginGateStore((s) => s.close);
  const dismiss = useLoginGateStore((s) => s.dismiss);
  const signIn = useSignIn();

  const onSignIn = async (provider: SignInProvider) => {
    const session = await signIn.mutateAsync(provider).catch(() => null);
    // Signed in: close; PendingSaveReplay saves the meal once the session
    // reaches the app.
    if (session) close();
  };

  if (presentation === "modal" && hosts > 0) return null;
  return <LoginGateSheet reason={reason} onClose={dismiss} onSignIn={(p) => void onSignIn(p)} isSigningIn={signIn.isPending} presentation={presentation} />;
}

// Saves the meal a guest tried to save, once they've signed in (the save
// actions here read the new session, unlike the guest's own tap). Mounted
// once, next to the root GlobalLoginGate.
export function PendingSaveReplay() {
  const { session } = useAuth();
  const pendingSave = useLoginGateStore((s) => s.pendingSave);
  const clearPending = useLoginGateStore((s) => s.clearPending);
  const saved = useSavedMealActions();

  // Dismissing the sheet forgets the save (useLoginGateStore.dismiss), so
  // one still pending here is waiting on the session.
  useEffect(() => {
    if (!pendingSave || !session) return;
    clearPending();
    void saved.save(pendingSave);
    // saved.save reads the current session; the inputs above are what matter.
  }, [session, pendingSave]);

  return null;
}
