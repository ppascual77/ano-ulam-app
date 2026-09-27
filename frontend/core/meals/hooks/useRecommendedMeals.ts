import { useMemo } from "react";
import { useRealMeals } from "./useRealMeals";
import type { MealType } from "../mealTypes";

const RECOMMENDATION_COUNT = 5;

function sampleRandom<T>(pool: T[], count: number): T[] {
  const shuffled = [...pool].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, count);
}

// Home's Recommendations carousel — a random sample of real, already-seeded
// meals (unlike Community Favorites, which stays on mock data for now).
// The sample is memoized against the fetched list's reference, so it stays
// stable across re-renders and only reshuffles when the underlying data
// actually refetches, not on every interaction.
export function useRecommendedMeals(): { meals: MealType[]; isLoading: boolean; isError: boolean } {
  const { data: allMeals, isLoading, isError } = useRealMeals();
  const meals = useMemo(() => (allMeals ? sampleRandom(allMeals, RECOMMENDATION_COUNT) : []), [allMeals]);
  return { meals, isLoading, isError };
}
