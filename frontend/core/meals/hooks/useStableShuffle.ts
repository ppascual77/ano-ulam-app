import { useMemo, useRef } from "react";
import type { MealType } from "../mealTypes";

// A random order that stays put. Each meal gets a random rank the first time
// it's seen, so a catalog refresh (a save count changing, a refetch) keeps
// the same meals in the same order instead of reshuffling under the user.
// A new `seed` (another category, another meal opened) starts a fresh order.
export function useStableShuffle(meals: MealType[], seed: string | null = null): MealType[] {
  const ranks = useRef<{ seed: string | null; byKey: Map<string, number> }>({ seed, byKey: new Map() });
  if (ranks.current.seed !== seed) ranks.current = { seed, byKey: new Map() };
  const { byKey } = ranks.current;
  const rankOf = (meal: MealType) => {
    const key = meal.id ?? meal.name;
    let rank = byKey.get(key);
    if (rank === undefined) {
      rank = Math.random();
      byKey.set(key, rank);
    }
    return rank;
  };
  return useMemo(() => [...meals].sort((a, b) => rankOf(a) - rankOf(b)), [meals, seed]);
}
