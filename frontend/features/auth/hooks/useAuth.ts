import { useMutation } from "@tanstack/react-query";
import { deleteAccount, signInWithGoogle, signOut } from "@/api/auth";
import { useAuthStore } from "../store/useAuthStore";

export function useAuth() {
  const session = useAuthStore((s) => s.session);
  const loading = useAuthStore((s) => s.loading);
  // Admin comes from app_metadata (set server-side, users can't edit it),
  // never from users.tier, which users can still change on their own row.
  const isAdmin = session?.user.app_metadata?.role === "admin";
  return { session, loading, isSignedIn: !!session, isAdmin };
}

export function useSignInWithGoogle() {
  return useMutation({ mutationFn: signInWithGoogle });
}

export function useSignOut() {
  return useMutation({ mutationFn: signOut });
}

export function useDeleteAccount() {
  return useMutation({ mutationFn: deleteAccount });
}
