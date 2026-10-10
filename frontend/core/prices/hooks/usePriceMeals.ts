import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { getMealsUsingIngredientIds } from "@/api/priceWatch";
import { mealIngredientLinePrice, mealRowToMealType } from "@/frontend/core/meals/utils/mealAdapter";
import type { MealType } from "@/frontend/core/meals/mealTypes";
import type { PriceItem } from "../utils/prices";
import { priceKeys } from "../queryKeys";
import { usePriceItems } from "./usePriceItems";

const BEST_VALUE_LIMIT = 5;
// A meal only counts as "best value" when it's at least this much cheaper
// than last week overall (increases included).
const MIN_NET_SAVING = 5;
const MEALS_FOR_LIMIT = 8;

// Meal rows using any of `ingredientIds`, one per meal, in the ids' order.
async function loadMealRows(ingredientIds: string[], limit = Infinity) {
  const rows = await getMealsUsingIngredientIds(ingredientIds);
  const rank = new Map(ingredientIds.map((id, i) => [id, i]));
  const seen = new Set<string>();
  return rows
    .sort((a, b) => (rank.get(a.ingredient_id) ?? 0) - (rank.get(b.ingredient_id) ?? 0))
    .filter((r) => !seen.has(r.meal.id) && !!seen.add(r.meal.id))
    .slice(0, limit);
}

async function loadMeals(ingredientIds: string[], limit: number): Promise<MealType[]> {
  const rows = await loadMealRows(ingredientIds, limit);
  return rows.map((r) => mealRowToMealType(r.meal, r.meal.meal_ingredients));
}

export type BestValueMeal = {
  meal: MealType;
  /** The meal's biggest drop this week (the card's chip). */
  drop: { name: string; pct: number };
  /** Estimated ₱ the meal costs less than last week: the net change across
   *  all of its DA-linked ingredients, increases included. Estimated: each
   *  line's price is its cheapest source, which is the DA price only some of
   *  the time. Always at least MIN_NET_SAVING (other meals are left out). */
  saving: number;
};

// Each linked ingredient's % change this week: the mean of its DA
// commodities' (e.g. Bangus ← Large and Medium), so one big mover among
// several doesn't overstate it.
function ingredientChanges(items: PriceItem[]): Map<string, number> {
  const all = new Map<string, number[]>();
  for (const i of items) {
    if (!i.ingredientId || i.pctChange == null) continue;
    all.set(i.ingredientId, [...(all.get(i.ingredientId) ?? []), i.pctChange]);
  }
  return new Map([...all].map(([id, pcts]) => [id, pcts.reduce((a, b) => a + b, 0) / pcts.length]));
}

// Every meal using a dropped ingredient, scored by its NET change this week:
// a pepper that dropped 1% doesn't make a meal cheaper if its garlic went
// up 3%. Only meals at least MIN_NET_SAVING cheaper overall make the cut,
// biggest saving first.
async function loadBestValueMeals(changes: Map<string, number>, ingredientIds: string[]): Promise<BestValueMeal[]> {
  const rows = await loadMealRows(ingredientIds);
  const scored = rows.map((r) => {
    let drop: BestValueMeal["drop"] | null = null;
    let saving = 0;
    for (const mi of r.meal.meal_ingredients) {
      const pct = changes.get(mi.ingredient_id);
      if (pct == null) continue;
      if (pct < 0 && (!drop || pct < drop.pct)) drop = { name: mi.ingredient.display_name ?? mi.ingredient.canonical_name, pct };
      // The line's price now is after the change; last week's was now / (1 + pct).
      const line = mealIngredientLinePrice(mi);
      if (line != null) saving += line / (1 + pct / 100) - line;
    }
    return { row: r, drop, saving };
  });
  return scored
    .filter((s): s is typeof s & { drop: BestValueMeal["drop"] } => s.drop != null && s.saving >= MIN_NET_SAVING)
    .sort((a, b) => b.saving - a.saving)
    .slice(0, BEST_VALUE_LIMIT)
    .map(({ row, drop, saving }) => ({ meal: mealRowToMealType(row.meal, row.meal.meal_ingredients), drop, saving }));
}

// "This week's best value meals": meals that cost meaningfully less than
// last week overall, biggest saving first (see loadBestValueMeals).
export function useBestValueMeals() {
  const items = usePriceItems();
  const changes = useMemo(() => ingredientChanges(items.data ?? []), [items.data]);
  const ingredientIds = useMemo(
    () =>
      [...changes]
        .filter(([, pct]) => pct < 0)
        .sort((a, b) => a[1] - b[1])
        .map(([id]) => id),
    [changes],
  );

  const meals = useQuery({
    queryKey: priceKeys.bestValueMeals(ingredientIds),
    queryFn: () => loadBestValueMeals(changes, ingredientIds),
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
