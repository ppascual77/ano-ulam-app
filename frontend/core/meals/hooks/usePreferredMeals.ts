import { useMemo } from "react";
import { fitsPreferences } from "@/frontend/core/budget/utils/budgetMatch";
import { usePreferences } from "@/frontend/core/preferences/hooks/usePreferences";
import { useRealMeals } from "./useRealMeals";
import type { MealType } from "../mealTypes";

// The real catalog (useRealMeals' bulk list, no ingredients) narrowed to
// the user's preferences: none of their allergens, their dietary focus.
// What every "pick for you" spot draws from: Surprise me, Today's pick, the
// moods, Related meals.
export function usePreferredMeals(): { meals: MealType[]; isLoading: boolean } {
  const { data, isLoading } = useRealMeals();
  const { prefs } = usePreferences();
  const { allergens, dietary_focus } = prefs;
  const meals = useMemo(
    () => (data ?? []).filter((meal) => fitsPreferences(meal, { allergens, dietary_focus })),
    [data, allergens, dietary_focus],
  );
  return { meals, isLoading };
}
