import { useCallback } from "react";
import type { QueryClient } from "@tanstack/react-query";
import type { ProReward } from "@/api/proRewards";
import { useProStore } from "../store/useProStore";
import { proKeys } from "../queryKeys";
import { useProRewards } from "./useProRewardProgress";

// The post or recipe that earned a Pro reward: deleting it (or editing out
// the post's photo) takes the reward back (the pro_reward_revoke
// migration). Before doing that, the app says so, but only when it would
// change something: the reward's days are still running and there's no
// subscription carrying Pro anyway.

/** A function telling whether removing this post or recipe would take Pro
 *  days back: the reward's days, or null when nothing would change. */
export function useRewardAtStake() {
  const { data: rewards } = useProRewards();
  const subscription = useProStore((s) => s.subscription);
  const earnedUntil = useProStore((s) => s.earnedUntil);
  return useCallback(
    (kind: ProReward["kind"], sourceId: string | null | undefined): { days: number } | null => {
      if (!sourceId || subscription) return null;
      if (!earnedUntil || new Date(earnedUntil).getTime() <= Date.now()) return null;
      const reward = rewards?.find((r) => r.kind === kind && r.sourceId === sourceId && !r.revokedAt);
      return reward ? { days: reward.days } : null;
    },
    [rewards, subscription, earnedUntil],
  );
}

/** The warning line, for a delete (or photo removal) confirm. */
export const rewardLossLine = (what: "post" | "recipe", days: number, action = "Deleting it") =>
  `This ${what} earned you ${days} days of Pro. ${action} takes them back, and they can't be earned again.`;

/** After a post or recipe is deleted or loses its photo: re-read earned Pro
 *  and the rewards, in case one was just taken back. */
export function refreshProRewards(queryClient: QueryClient) {
  useProStore.getState().refresh();
  void queryClient.invalidateQueries({ queryKey: proKeys.all });
}
