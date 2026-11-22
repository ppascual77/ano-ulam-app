import { useCallback, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { getClaimedRewardKinds, getProRewards, progressOf, type ProRewardProgress } from "@/api/proRewards";
import { useAuth } from "@/frontend/features/auth/hooks/useAuth";
import { proKeys } from "../queryKeys";

/** The signed-in user's granted Pro rewards (empty for guests). Refetched
 *  when the app comes back to the foreground (RewardCelebration), so a
 *  recipe approved meanwhile shows up. */
export function useProRewards() {
  const userId = useAuth().session?.user.id ?? null;
  return useQuery({
    queryKey: proKeys.rewards(userId ?? ""),
    queryFn: () => getProRewards(userId!),
    enabled: !!userId,
  });
}

/** Reward kinds this person claimed under an earlier, deleted account
 *  (empty for guests and for almost everyone). */
function useClaimedRewardKinds() {
  const userId = useAuth().session?.user.id ?? null;
  return useQuery({
    queryKey: proKeys.claims(userId ?? ""),
    queryFn: getClaimedRewardKinds,
    enabled: !!userId,
  });
}

/** The signed-in user's progress toward Pro rewards (undefined for guests).
 *  Waits for both reads, so a reward claimed under a deleted account is
 *  never offered for a moment and then hidden. */
export function useProRewardProgress() {
  const query = useProRewards();
  const claims = useClaimedRewardKinds();
  const data = useMemo(
    () => (query.data && claims.data ? progressOf(query.data, claims.data) : undefined),
    [query.data, claims.data],
  );
  const { refetch: refetchRewards } = query;
  const { refetch: refetchClaims } = claims;
  const refetch = useCallback(() => Promise.all([refetchRewards(), refetchClaims()]), [refetchRewards, refetchClaims]);
  return { ...query, data, refetch };
}

/** Every reward earned: nothing left to pitch. */
export function allRewardsEarned(progress: ProRewardProgress) {
  return progress.approvedRecipes > 0 && progress.hasPhotoPost;
}
