import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { getMealsUsingIngredientIds } from "@/api/priceWatch";
import { mealRowToMealType } from "@/frontend/core/meals/utils/mealAdapter";
import type { MealType } from "@/frontend/core/meals/mealTypes";
import { priceKeys } from "../queryKeys";
import { usePriceItems } from "./usePriceItems";

const BEST_VALUE_LIMIT = 5;
const MEALS_FOR_LIMIT = 8;

async function loadMeals(ingredientIds: string[], limit: number): Promise<MealType[]> {
  const rows = await getMealsUsingIngredientIds(ingredientIds);
  const rank = new Map(ingredientIds.map((id, i) => [id, i]));
  const seen = new Set<string>();
  return rows
    .sort((a, b) => (rank.get(a.ingredient_id) ?? 0) - (rank.get(b.ingredient_id) ?? 0))
    .filter((r) => !seen.has(r.meal.id) && !!seen.add(r.meal.id))
    .slice(0, limit)
    .map((r) => mealRowToMealType(r.meal, r.meal.meal_ingredients));
}

// "This week's best value meals": meals using ingredients whose linked DA
// price dropped vs a week ago, biggest drop first.
export function useBestValueMeals() {
  const items = usePriceItems();
  const ingredientIds = useMemo(() => {
    const dropped = (items.data ?? [])
      .filter((i) => i.ingredientId && i.pctChange != null && i.pctChange < 0)
      .sort((a, b) => a.pctChange! - b.pctChange!);
    return [...new Set(dropped.map((i) => i.ingredientId!))];
  }, [items.data]);

  const meals = useQuery({
    queryKey: priceKeys.bestValueMeals(ingredientIds),
    queryFn: () => loadMeals(ingredientIds, BEST_VALUE_LIMIT),
    enabled: ingredientIds.length > 0,
    staleTime: 10 * 60 * 1000,
  });

  return {
    meals: meals.data ?? [],
    loading: items.isLoading || (ingredientIds.length > 0 && meals.isLoading),
  };
}

// "Meals with …" in the ingredient detail sheet. Unlinked commodities have
// no meals to show.
export function useMealsForIngredient(ingredientId: string | null) {
  return useQuery({
    queryKey: priceKeys.mealsFor(ingredientId),
    queryFn: () => loadMeals([ingredientId!], MEALS_FOR_LIMIT),
    enabled: !!ingredientId,
  });
}
