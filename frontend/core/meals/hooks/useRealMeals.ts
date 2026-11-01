import { useQuery } from "@tanstack/react-query";
import { getMeals } from "@/api/meals";
import { mealRowToMealType } from "../utils/mealAdapter";

export const realMealKeys = { list: ["meals", "real"] as const };

// The real (non-mock) backend catalog, mapped into the same MealType shape
// mock data already uses — same adapter Manage Meals (admin) uses, shared
// via core/meals/ since this is now a consumer-facing concern too. Bulk
// listing only (no meal_ingredients join) — fine for id resolution
// (MealListScreen's "See All") and for card display. A meal surfaced from
// here has no ingredients, so opening it in Meal Details fetches the full
// meal first (useFullMeal). Deliberately its own query
// key (not admin's ["admin", "meals", filters]) so a consumer screen
// doesn't share/pollute the admin cache namespace.
export function useRealMeals() {
  return useQuery({
    queryKey: realMealKeys.list,
    queryFn: async () => {
      const rows = await getMeals();
      return rows.map((row) => mealRowToMealType(row));
    },
    staleTime: 5 * 60 * 1000,
  });
}
