import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { getUserProfile, updateUserProfile, type UserProfile } from "@/api/auth";
import { authKeys } from "../queryKeys";
import { useAuth } from "./useAuth";
import { useAuthStore } from "../store/useAuthStore";

export function useUserProfile() {
  const { session } = useAuth();
  const userId = session?.user.id;

  return useQuery({
    queryKey: authKeys.userProfile(userId ?? ""),
    queryFn: () => getUserProfile(userId!),
    enabled: !!userId,
  });
}

// Reads the session imperatively (useAuthStore.getState()) rather than via the
// reactive hook, so this works correctly when called right after sign-in —
// before React has necessarily re-rendered with the just-updated session.
export function useUpdateUserProfile() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (patch: Partial<UserProfile>) => {
      const userId = useAuthStore.getState().session?.user.id;
      if (!userId) throw new Error("Not signed in");
      return updateUserProfile(userId, patch);
    },
    onSuccess: (data) => {
      const userId = useAuthStore.getState().session?.user.id;
      if (userId) queryClient.setQueryData(authKeys.userProfile(userId), data);
    },
  });
}

// The signed-in user's own photo. users.avatar_url is the source once the row
// has loaded (it can be changed or removed in the app); until then, the photo
// the sign-in provider sent, which is what the row starts with anyway.
export function useMyAvatarUrl(): string | null {
  const { session } = useAuth();
  const row = useUserProfile().data;
  if (row) return row.avatar_url;
  const meta = session?.user.user_metadata ?? {};
  return (meta.avatar_url as string | undefined) ?? (meta.picture as string | undefined) ?? null;
}
