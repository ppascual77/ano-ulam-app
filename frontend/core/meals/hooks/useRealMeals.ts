import { useQuery } from "@tanstack/react-query";
import { getMeals } from "@/api/meals";
import { mealRowToMealType } from "../utils/mealAdapter";

const realMealKeys = { list: ["meals", "real"] as const };

// The real (non-mock) backend catalog, mapped into the same MealType shape
// mock data already uses — same adapter Manage Meals (admin) uses, shared
// via core/meals/ since this is now a consumer-facing concern too. Bulk
// listing only (no meal_ingredients join), so a meal surfaced from here
// won't have its Ingredients section populated in the detail sheet yet —
// acceptable for this first "just link it" pass; fetching full per-meal
// detail is a natural follow-up once this needs to look finished rather
// than just work. Deliberately its own query key (not admin's ["admin",
// "meals", filters]) so a consumer screen doesn't share/pollute the admin
// cache namespace.
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
