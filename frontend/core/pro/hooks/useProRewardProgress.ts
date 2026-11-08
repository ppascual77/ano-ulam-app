import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { getProRewards, progressOf, type ProRewardProgress } from "@/api/proRewards";
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

/** The signed-in user's progress toward Pro rewards (undefined for guests). */
export function useProRewardProgress() {
  const query = useProRewards();
  const data = useMemo(() => (query.data ? progressOf(query.data) : undefined), [query.data]);
  return { ...query, data };
}

/** Every reward earned: nothing left to pitch. */
export function allRewardsEarned(progress: ProRewardProgress) {
  return progress.approvedRecipes > 0 && progress.hasPhotoPost;
}
