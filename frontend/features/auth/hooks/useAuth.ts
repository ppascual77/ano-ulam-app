import { useMutation } from "@tanstack/react-query";
import { signInWithGoogle, signOut } from "@/api/auth";
import { useAuthStore } from "../store/useAuthStore";

export function useAuth() {
  const session = useAuthStore((s) => s.session);
  const loading = useAuthStore((s) => s.loading);
  return { session, loading, isSignedIn: !!session };
}

export function useSignInWithGoogle() {
  return useMutation({ mutationFn: signInWithGoogle });
}

export function useSignOut() {
  return useMutation({ mutationFn: signOut });
}
