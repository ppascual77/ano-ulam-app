import { useMemo } from "react";
import { useRealMeals } from "./useRealMeals";
import { useStableShuffle } from "./useStableShuffle";
import type { MealType } from "../mealTypes";
import { inCategory, type CategoryId } from "@/frontend/core/budget/utils/categories";
import { fitsPreferences } from "@/frontend/core/budget/utils/budgetMatch";
import { usePreferences } from "@/frontend/core/preferences/hooks/usePreferences";

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
  const fitting = useMemo(
    () =>
      (allMeals ?? []).filter(
        (meal) => fitsPreferences(meal, { allergens, dietary_focus }) && (!category || inCategory(meal, category)),
      ),
    [allMeals, category, allergens, dietary_focus],
  );
  const shuffled = useStableShuffle(fitting, category);
  const meals = useMemo(() => (category ? shuffled : shuffled.slice(0, RECOMMENDATION_COUNT)), [shuffled, category]);
  return { meals, isLoading, isError };
}
