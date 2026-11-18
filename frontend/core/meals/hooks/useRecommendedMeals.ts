import { useMemo } from "react";
import { useRealMeals } from "./useRealMeals";
import { useStableShuffle } from "./useStableShuffle";
import type { MealType } from "../mealTypes";
import { inCategory, mealTimeFit, type CategoryId } from "@/frontend/core/budget/utils/categories";
import { fitsPreferences } from "@/frontend/core/budget/utils/budgetMatch";
import { usePreferences } from "@/frontend/core/preferences/hooks/usePreferences";
import { useAvoidFilter } from "@/frontend/core/preferences/hooks/useAvoidFilter";

// Shown 5 at a time (RecommendationsSection's Show More).
const RECOMMENDATION_COUNT = 10;

// Home's Recommendations carousel: a random sample of 10 real, already-seeded
// meals; with a Categories tile picked, every meal in that category instead
// (shuffled). Only meals that fit the user's preferences (no allergens,
// their dietary focus), same as Suggest by Budget.
// Straight from useRealMeals' bulk list (no ingredients): a tapped card's
// Meal Details fetches the full meal (useFullMeal in MealCarouselSection).
// The order is shuffled once per category (useStableShuffle), so a catalog
// refresh (a save changing a count) keeps the same meals in place.
export function useRecommendedMeals(category: CategoryId | null = null): { meals: MealType[]; isLoading: boolean; isError: boolean } {
  const { data: allMeals, isLoading, isError } = useRealMeals();
  const { prefs } = usePreferences();
  const { allergens, dietary_focus } = prefs;
  const { isAvoided } = useAvoidFilter();
  const fitting = useMemo(
    () =>
      (allMeals ?? []).filter(
        (meal) =>
          fitsPreferences(meal, { allergens, dietary_focus }) && !isAvoided(meal) && (!category || inCategory(meal, category)),
      ),
    [allMeals, category, allergens, dietary_focus, isAvoided],
  );
  const shuffled = useStableShuffle(fitting, category);
  // Lunch and Dinner hold mostly the same meals: each puts the ones that
  // suit it best first (mealTimeFit), shuffled within the same fit, so the
  // two tiles open on different meals. The sort is stable, so the shuffle
  // still decides ties.
  const meals = useMemo(() => {
    if (!category) return shuffled.slice(0, RECOMMENDATION_COUNT);
    if (category !== "lunch" && category !== "dinner") return shuffled;
    return [...shuffled].sort((a, b) => mealTimeFit(b, category) - mealTimeFit(a, category));
  }, [shuffled, category]);
  return { meals, isLoading, isError };
}
