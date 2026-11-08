import { useQuery } from "@tanstack/react-query";
import { getProRewardProgress, type ProRewardProgress } from "@/api/proRewards";
import { useAuth } from "@/frontend/features/auth/hooks/useAuth";
import { RECIPE_REWARD_MAX } from "../proContent";
import { proKeys } from "../queryKeys";

/** The signed-in user's progress toward Pro rewards (null for guests). */
export function useProRewardProgress() {
  const userId = useAuth().session?.user.id ?? null;
  return useQuery({
    queryKey: proKeys.rewardProgress(userId ?? ""),
    queryFn: () => getProRewardProgress(userId!),
    enabled: !!userId,
  });
}

/** Every reward earned: nothing left to pitch. */
export function allRewardsEarned(progress: ProRewardProgress) {
  return progress.approvedRecipes >= RECIPE_REWARD_MAX && progress.hasPhotoPost;
}
