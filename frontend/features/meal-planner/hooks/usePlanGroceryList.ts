import { useMemo, useState } from "react";
import { useQueries } from "@tanstack/react-query";
import { getMeal } from "@/api/meals";
import { mealRowToMealType } from "@/frontend/core/meals/utils/mealAdapter";
import { scaleMeal } from "@/frontend/core/meals/utils/scaleMeal";
import { buildGroceryList, type GroceryItem } from "@/frontend/core/grocery/utils/buildGroceryList";
import type { MealType } from "@/frontend/core/meals/mealTypes";
import type { MealPlan } from "../utils/generatePlan";

// Mock planner meals ("planner-..." ids) have no recipe behind them.
const isRealMeal = (id: string | undefined): id is string => !!id && !id.startsWith("planner-");

// The plan's grocery list: every meal in the given days (all 5 for Premium,
// today for Free), each with its real ingredients scaled to the people
// being cooked for, merged with the same builder as Profile's Grocery tab.
// Ingredients come from fetching each real meal once (the plan's meals come
// from the bulk list, which has none). Checkboxes are kept on screen only.
export function usePlanGroceryList(plan: MealPlan | null, dayIndexes: number[], enabled: boolean) {
  const days = useMemo(() => (plan ? dayIndexes.map((i) => plan.days[i]).filter(Boolean) : []), [plan, dayIndexes]);
  const ids = useMemo(() => [...new Set(days.flatMap((d) => d.meals.map((m) => m.meal.id)).filter(isRealMeal))], [days]);

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

  const [checked, setChecked] = useState<Set<string>>(new Set());
  const toggle = (item: GroceryItem) =>
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(item.id)) next.delete(item.id);
      else next.add(item.id);
      return next;
    });

  const total = items.reduce((sum, item) => (item.category === "main" ? sum + item.price : sum), 0);
  return { items, total, loading, isChecked: (item: GroceryItem) => checked.has(item.id), toggle };
}
