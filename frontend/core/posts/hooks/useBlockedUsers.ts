import { useQuery, useQueryClient } from "@tanstack/react-query";
import { getBlockedUsers, unblockUser, type BlockedUser } from "@/api/blocks";
import { useAuth } from "@/frontend/features/auth/hooks/useAuth";
import { postKeys } from "../queryKeys";

// Settings → Blocked accounts: who you blocked, and unblocking (their posts
// come back to your lists).
export function useBlockedUsers(enabled: boolean) {
  const queryClient = useQueryClient();
  const { session } = useAuth();
  const viewerId = session?.user.id ?? null;
  const queryKey = postKeys.blocked(viewerId);
  const query = useQuery({ queryKey, queryFn: getBlockedUsers, enabled: enabled && !!viewerId });

  const unblock = async (userId: string): Promise<boolean> => {
    queryClient.setQueryData<BlockedUser[]>(queryKey, (list) => list?.filter((u) => u.user_id !== userId));
    try {
      await unblockUser(userId);
      void queryClient.invalidateQueries({ queryKey: postKeys.all(viewerId) });
      return true;
    } catch {
      void queryClient.invalidateQueries({ queryKey });
      return false;
    }
  };

  return { users: query.data ?? [], loading: query.isLoading, error: query.isError, unblock };
}
