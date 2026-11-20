import { useMutation } from "@tanstack/react-query";
import { showGlobalToast } from "@/frontend/components/ui";
import { deleteAccount, signIn, signOut, type SignInProvider } from "@/api/auth";
import { forgetPushToken } from "@/frontend/core/notifications/push";
import { useAuthStore } from "../store/useAuthStore";
import { useAuthActivityStore } from "../store/useAuthActivityStore";

export type { SignInProvider };

export function useAuth() {
  const session = useAuthStore((s) => s.session);
  const loading = useAuthStore((s) => s.loading);
  // Admin comes from app_metadata (set server-side, users can't edit it),
  // never from users.tier, which users can still change on their own row.
  const isAdmin = session?.user.app_metadata?.role === "admin";
  return { session, loading, isSignedIn: !!session, isAdmin };
}

/** Apple or Google: `mutateAsync("apple")`. Resolves null if the user
 *  cancels. Once the provider says yes, AuthActivityOverlay covers the app until
 *  the sign-in settles. `holdOverlay`: keep it up after a successful sign-in,
 *  for a screen with more to do first (onboarding saving preferences), which
 *  then takes it down with `useAuthActivityStore.getState().setActivity(null)`. */
export function useSignIn({ holdOverlay = false }: { holdOverlay?: boolean } = {}) {
  const setActivity = useAuthActivityStore((s) => s.setActivity);
  return useMutation({
    mutationFn: (provider: SignInProvider) => signIn(provider, () => setActivity("signingIn")),
    // Every sign-in button goes through here, so a failure always says so
    // (it used to fade the overlay and show nothing on onboarding, the
    // login sheet, the Pro page and Add a Recipe). Cancelling resolves
    // null, not an error, so it stays quiet.
    onError: (error) => showGlobalToast({ tone: "error", message: signInErrorMessage(error) }),
    onSettled: (session, error) => {
      if (!holdOverlay || error || !session) setActivity(null);
    },
  });
}

export function useSignOut() {
  // This phone stops getting the account's pushes first (needs the session).
  return useMutation({
    mutationFn: async () => {
      await forgetPushToken();
      await signOut();
    },
  });
}

export function useDeleteAccount() {
  return useMutation({ mutationFn: deleteAccount });
}

/** What a failed sign-in tells the user, by cause. */
export function signInErrorMessage(error: unknown): string {
  const code = String((error as { code?: unknown } | null)?.code ?? "");
  const message = error instanceof Error ? error.message : "";
  // Google on Android: this build's signing key isn't registered in Google
  // Cloud (code 10). Not the user's fault, nothing they can retry.
  if (code === "10" || /DEVELOPER_ERROR/.test(message)) {
    return "Google sign-in isn't available in this version yet. We're on it.";
  }
  if (code === "PLAY_SERVICES_NOT_AVAILABLE") {
    return "Google sign-in needs Google Play services. Update it and try again.";
  }
  if (/network|fetch|timed? ?out|offline|abort/i.test(message)) {
    return "Couldn't reach AnoUlam. Check your connection and try again.";
  }
  return "Sign-in didn't go through. Please try again.";
}
