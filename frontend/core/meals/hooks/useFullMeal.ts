import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { getMeal } from "@/api/meals";
import { mealRowToMealType } from "../utils/mealAdapter";
import { scaleMeal } from "../utils/scaleMeal";
import type { MealType } from "../mealTypes";

// The meal to open in Meal Details. Cards from a bulk list (useRealMeals:
// no ingredients) are fetched in full (ingredients, micronutrients). The
// sheet doesn't wait for it: `meal` is the card's meal at once, with
// `loading` true (MealDetailSheet shows its skeleton, real photo and name),
// and the full meal takes its place when it arrives. If the card showed it at
// other servings (Suggest by Budget's results), the full meal is re-based to
// those too. Should the fetch fail for good, the card's meal stays.
export function useFullMeal(meal: MealType | null): { meal: MealType | null; loading: boolean } {
  const needsFetch = !!meal?.id && !meal.ingredients;
  const query = useQuery({
    queryKey: ["meals", "full", meal?.id],
    queryFn: () => getMeal(meal!.id as string),
    enabled: needsFetch,
  });
  // Memoized: a new object every render would read as a new meal to the
  // sheet (resetting its related-meals history).
  const full = useMemo(() => {
    if (!meal || !needsFetch || !query.data) return null;
    const row = mealRowToMealType(query.data, query.data.meal_ingredients);
    return meal.serving_size && meal.serving_size !== row.serving_size ? scaleMeal(row, meal.serving_size) : row;
  }, [meal, needsFetch, query.data]);
  if (!meal) return { meal: null, loading: false };
  if (!needsFetch) return { meal, loading: false };
  return { meal: full ?? meal, loading: !full && !query.isError };
}
