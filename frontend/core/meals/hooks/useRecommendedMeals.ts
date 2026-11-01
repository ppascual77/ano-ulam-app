import { useMemo } from "react";
import { useRealMeals } from "./useRealMeals";
import type { MealType } from "../mealTypes";
import { inCategory, type CategoryId } from "@/frontend/core/budget/utils/categories";
import { fitsPreferences } from "@/frontend/core/budget/utils/budgetMatch";
import { usePreferences } from "@/frontend/core/preferences/hooks/usePreferences";

// Shown 5 at a time (RecommendationsSection's Show More).
const RECOMMENDATION_COUNT = 10;

function shuffle<T>(pool: T[]): T[] {
  return [...pool].sort(() => Math.random() - 0.5);
}

// Home's Recommendations carousel: a random sample of 10 real, already-seeded
// meals; with a Categories tile picked, every meal in that category instead
// (shuffled). Only meals that fit the user's preferences (no allergens,
// their dietary focus), same as Suggest by Budget. Unlike Community Favorites, which stays on mock data for now.
// Straight from useRealMeals' bulk list (no ingredients): a tapped card's
// Meal Details fetches the full meal (useFullMeal in MealCarouselSection).
// Memoized against the bulk list and the category, so it only reshuffles
// when either changes, not on every re-render.
export function useRecommendedMeals(category: CategoryId | null = null): { meals: MealType[]; isLoading: boolean; isError: boolean } {
  const { data: allMeals, isLoading, isError } = useRealMeals();
  const { prefs } = usePreferences();
  const { allergens, dietary_focus } = prefs;
  const meals = useMemo(() => {
    if (!allMeals) return [];
    const fitting = allMeals.filter((meal) => fitsPreferences(meal, { allergens, dietary_focus }));
    if (category) return shuffle(fitting.filter((meal) => inCategory(meal, category)));
    return shuffle(fitting).slice(0, RECOMMENDATION_COUNT);
  }, [allMeals, category, allergens, dietary_focus]);
  return { meals, isLoading, isError };
}
