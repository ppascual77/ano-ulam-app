import { useQuery } from "@tanstack/react-query";
import { getMeal } from "@/api/meals";
import { mealRowToMealType } from "../utils/mealAdapter";
import { scaleMeal } from "../utils/scaleMeal";
import type { MealType } from "../mealTypes";

// The meal to open in Meal Details. Cards from a bulk list (useRealMeals:
// no ingredients) would open a detail with no ingredient list and no
// micronutrients, so a meal without ingredients is fetched in full first.
// Null until it's here, so the sheet opens with everything in place. If the
// card showed it at other servings (Suggest by Budget's results), the full
// meal is re-based to those too.
export function useFullMeal(meal: MealType | null): MealType | null {
  const needsFetch = !!meal?.id && !meal.ingredients;
  const query = useQuery({
    queryKey: ["meals", "full", meal?.id],
    queryFn: () => getMeal(meal!.id as string),
    enabled: needsFetch,
  });
  if (!meal) return null;
  if (!needsFetch) return meal;
  if (!query.data) return null;
  const full = mealRowToMealType(query.data, query.data.meal_ingredients);
  return meal.serving_size && meal.serving_size !== full.serving_size ? scaleMeal(full, meal.serving_size) : full;
}
