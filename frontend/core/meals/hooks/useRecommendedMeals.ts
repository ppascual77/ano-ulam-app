import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { getMeal } from "@/api/meals";
import { useRealMeals } from "./useRealMeals";
import { mealRowToMealType } from "../utils/mealAdapter";
import type { MealType } from "../mealTypes";

const RECOMMENDATION_COUNT = 5;

function sampleRandom<T>(pool: T[], count: number): T[] {
  const shuffled = [...pool].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, count);
}

// Home's Recommendations carousel — a random sample of real, already-seeded
// meals (unlike Community Favorites, which stays on mock data for now).
// Picking ids happens off useRealMeals' bulk (no-join) list, but each
// sampled meal is then fetched again individually via getMeal (which DOES
// join meal_ingredients) — only 5 of them, so the extra round trips are
// cheap, and it's what lets a tapped card's detail sheet actually show its
// Ingredients section instead of an empty one. The id sample itself is
// memoized against the bulk list's reference, so it only reshuffles when
// that list actually refetches, not on every re-render.
export function useRecommendedMeals(): { meals: MealType[]; isLoading: boolean; isError: boolean } {
  const { data: allMeals, isLoading: isLoadingList, isError: isListError } = useRealMeals();

  const sampledIds = useMemo(() => {
    if (!allMeals) return [];
    return sampleRandom(allMeals, RECOMMENDATION_COUNT)
      .map((meal) => meal.id)
      .filter((id): id is string => !!id);
  }, [allMeals]);

  const {
    data: detailedMeals,
    isLoading: isLoadingDetail,
    isError: isDetailError,
  } = useQuery({
    queryKey: ["meals", "recommendations-detail", sampledIds],
    queryFn: async () => {
      const rows = await Promise.all(sampledIds.map((id) => getMeal(id)));
      return rows.map((row) => mealRowToMealType(row, row.meal_ingredients));
    },
    enabled: sampledIds.length > 0,
  });

  return {
    meals: detailedMeals ?? [],
    isLoading: isLoadingList || (sampledIds.length > 0 && isLoadingDetail),
    isError: isListError || isDetailError,
  };
}
