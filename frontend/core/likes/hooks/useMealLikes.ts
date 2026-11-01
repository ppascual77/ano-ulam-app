import { useCallback, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { create } from "zustand";
import { getLikeCount, likeMeal, listLikedMealIds, unlikeMeal } from "@/api/likes";
import { showGlobalToast } from "@/frontend/components/ui";
import { useAuth } from "@/frontend/features/auth/hooks/useAuth";
import type { MealType } from "@/frontend/core/meals/mealTypes";

// The one source of meal likes (public.meal_likes, api/likes), shared by
// every heart: meal cards, Meal Details, Discover, Browse. Liking anywhere
// shows everywhere, like saves do.
//
// Which meals you liked: one query per account. Counts: each meal's
// like_count from its row, overridden here once you've liked or unliked it
// (the fresh count from the database), so every screen shows the same
// number. A tap flips at once and reverts if saving fails.

export type LikeEntry = { liked: boolean; count: number };

const likedKey = (userId: string | null) => ["likes", userId ?? "guest"] as const;

const useLikeCounts = create<{ counts: Record<string, number>; setCount: (id: string, count: number) => void }>((set) => ({
  counts: {},
  setCount: (id, count) => set((state) => ({ counts: { ...state.counts, [id]: Math.max(0, count) } })),
}));

export function useMealLikes() {
  const userId = useAuth().session?.user.id ?? null;
  const queryClient = useQueryClient();
  const likedQuery = useQuery({
    queryKey: likedKey(userId),
    queryFn: listLikedMealIds,
    enabled: !!userId,
    staleTime: 5 * 60 * 1000,
  });
  const likedIds = useMemo(() => new Set(likedQuery.data ?? []), [likedQuery.data]);
  const counts = useLikeCounts((s) => s.counts);
  const setCount = useLikeCounts((s) => s.setCount);

  const likeOf = useCallback(
    (meal: MealType): LikeEntry => {
      const id = meal.id;
      return {
        liked: !!id && likedIds.has(id),
        count: id && id in counts ? counts[id] : (meal.like_count ?? 0),
      };
    },
    [likedIds, counts],
  );

  /** Likes or unlikes. "signin": not signed in (nothing changed). */
  const toggle = useCallback(
    async (meal: MealType): Promise<"ok" | "signin" | "error"> => {
      const id = meal.id;
      if (!id) return "error";
      if (!userId) return "signin";
      const before = likeOf(meal);
      const key = likedKey(userId);
      const write = (liked: boolean, count: number) => {
        queryClient.setQueryData<string[]>(key, (prev = []) => (liked ? [...new Set([...prev, id])] : prev.filter((x) => x !== id)));
        setCount(id, count);
      };
      write(!before.liked, before.count + (before.liked ? -1 : 1));
      try {
        if (before.liked) await unlikeMeal(id);
        else await likeMeal(id);
        setCount(id, await getLikeCount(id));
        return "ok";
      } catch {
        write(before.liked, before.count);
        return "error";
      }
    },
    [userId, likeOf, queryClient, setCount],
  );

  return { likeOf, toggle, isSignedIn: !!userId };
}

/** One meal's heart, for a card or Meal Details with no like handling of
 *  their own: a guest is asked to sign in, a failed save says so. */
export function useMealLike(meal: MealType): LikeEntry & { toggle: () => void } {
  const { likeOf, toggle } = useMealLikes();
  const entry = likeOf(meal);
  return {
    ...entry,
    toggle: () => {
      void toggle(meal).then((result) => {
        if (result === "signin") showGlobalToast({ message: "Sign in to like meals.", tone: "error" });
        if (result === "error") showGlobalToast({ message: "Couldn't update your like. Please try again.", tone: "error" });
      });
    },
  };
}
