import { useCallback, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { getMealIngredientIndex } from "@/api/meals";
import type { AvoidedIngredient } from "@/api/auth";
import type { MealType } from "@/frontend/core/meals/mealTypes";
import { useIsPro } from "@/frontend/core/pro/store/useProStore";
import { usePreferences } from "./usePreferences";

// Pro's "Ingredients to avoid": a test for whether a meal uses any of them,
// shared by every list that hides those meals (Suggest Meals, Browse, the
// Meal Planner's pool). Off (nothing hidden) unless the user is Pro and has
// picked something.
//
// Catalog meals are matched by ingredient id, through the same meal ->
// ingredients index Pantry's matching uses (same query, so it's shared and
// cached). Meals that aren't in it (the mock catalog) only have ingredient
// names, so those match by name: an avoided "Pork belly, raw" catches
// "Pork belly, cubed" through its first part, "pork belly".

// "Pork belly, raw" -> "pork belly": the part before the first comma, which
// names the food (the rest is usually its state).
const foodName = (name: string) => name.split(",")[0].trim().toLowerCase();

function nameMatchers(avoided: AvoidedIngredient[]): string[] {
  return [...new Set(avoided.flatMap((a) => [foodName(a.name), ...a.aliases.map((alias) => alias.trim().toLowerCase())]))].filter(
    (n) => n.length >= 3,
  );
}

export function useAvoidFilter() {
  const isPro = useIsPro();
  const { prefs } = usePreferences();
  const avoided = isPro ? prefs.avoid_ingredients : [];
  const active = avoided.length > 0;

  const { data: index } = useQuery({
    queryKey: ["meals", "ingredient-index"],
    queryFn: getMealIngredientIndex,
    staleTime: 5 * 60 * 1000,
    enabled: active,
  });

  // Meal id -> its ingredient ids, for catalog meals.
  const ingredientsByMeal = useMemo(() => {
    const map = new Map<string, Set<string>>();
    for (const meal of index ?? []) map.set(meal.id, new Set(meal.meal_ingredients.map((mi) => mi.ingredient_id)));
    return map;
  }, [index]);

  const avoidedIds = useMemo(() => new Set(avoided.map((a) => a.id)), [avoided]);
  const names = useMemo(() => nameMatchers(avoided), [avoided]);

  /** True when the meal uses an ingredient the user avoids. */
  const isAvoided = useCallback(
    (meal: Pick<MealType, "id" | "ingredients">) => {
      if (!active) return false;
      const ids = ingredientsByMeal.get(String(meal.id));
      if (ids) return [...ids].some((id) => avoidedIds.has(id));
      return (meal.ingredients ?? []).some((ingredient) => {
        const name = ingredient.name.toLowerCase();
        return names.some((n) => name.includes(n));
      });
    },
    [active, ingredientsByMeal, avoidedIds, names],
  );

  return { isAvoided, active, avoided };
}
