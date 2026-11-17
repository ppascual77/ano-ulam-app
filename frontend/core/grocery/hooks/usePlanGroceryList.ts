import { useMemo } from "react";
import { useQueries } from "@tanstack/react-query";
import { getMeal } from "@/api/meals";
import { mealRowToMealType } from "@/frontend/core/meals/utils/mealAdapter";
import { scaleMeal } from "@/frontend/core/meals/utils/scaleMeal";
import { buildGroceryList, type GroceryItem } from "../utils/buildGroceryList";
import type { MealType } from "@/frontend/core/meals/mealTypes";

// Just what the list needs from a meal plan (the Meal Planner's MealPlan
// fits), so core doesn't depend on the feature.
export type GroceryPlan = { servings: number; days: { meals: { meal: MealType }[] }[] };

const hasId = (id: string | undefined): id is string => !!id;

// The meal plan's grocery list (the grocery sheet's "Meal plan" tab): every
// meal in the given days (all 5 for Premium, today for Free), each with its
// real ingredients scaled to the people
// being cooked for, merged with the same builder as Profile's Grocery tab.
// Ingredients come from fetching each real meal once (the plan's meals come
// from the bulk list, which has none). What's at home comes from the pantry
// (see groupGroceryItems).
export function usePlanGroceryList(plan: GroceryPlan | null, dayIndexes: number[], enabled: boolean) {
  const days = useMemo(() => (plan ? dayIndexes.map((i) => plan.days[i]).filter(Boolean) : []), [plan, dayIndexes]);
  const ids = useMemo(() => [...new Set(days.flatMap((d) => d.meals.map((m) => m.meal.id)).filter(hasId))], [days]);

  const queries = useQueries({
    queries: ids.map((id) => ({
      queryKey: ["meals", "with-ingredients", id],
      queryFn: async () => {
        const row = await getMeal(id);
        return mealRowToMealType(row, row.meal_ingredients);
      },
      enabled,
      staleTime: 5 * 60 * 1000,
    })),
  });
  const loading = queries.some((q) => q.isLoading);
  const fullById = useMemo(() => {
    const map = new Map<string, MealType>();
    queries.forEach((q, i) => q.data && map.set(ids[i], q.data));
    return map;
    // Re-derive when any fetch lands.
  }, [ids, queries.map((q) => q.dataUpdatedAt).join(",")]);

  const items: GroceryItem[] = useMemo(() => {
    if (!plan) return [];
    const cooked = days.flatMap((day) =>
      day.meals.map(({ meal }) => scaleMeal(fullById.get(meal.id as string) ?? meal, plan.servings)),
    );
    return buildGroceryList(cooked);
  }, [days, fullById, plan]);

  const total = items.reduce((sum, item) => (item.category === "main" ? sum + item.price : sum), 0);
  return { items, total, loading };
}
