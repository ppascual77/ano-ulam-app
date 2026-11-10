import { useMutation } from "@tanstack/react-query";
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
