import { useCallback, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { getMealIngredientIndex } from "@/api/meals";
import type { AvoidedIngredient } from "@/api/auth";
import type { MealType } from "@/frontend/core/meals/mealTypes";
import { useIsPro } from "@/frontend/core/pro/store/useProStore";
import { usePreferences } from "./usePreferences";
import { isCovered } from "../avoidMatch";

// Pro's "Ingredients to avoid": whether a meal uses any of them, for every
// list that follows the user's preferences (Suggest by Budget and Pantry,
// Recommendations, Browse, Surprise me, Today's pick, the moods, Related
// meals, Community Favorites, the Meal Planner). Off (nothing hidden)
// unless the user is Pro and has picked something.
//
// Catalog meals are matched by their ingredients' catalog names (see
// avoidMatch: one food by base name, or a whole food), through the same meal ->
// ingredients index Suggest by Pantry uses (same query, shared and cached).
// A meal that isn't in it (e.g. a saved snapshot of a meal since removed)
// only has ingredient names, so it matches by name: an avoided "Pork belly,
// raw" catches "Pork belly, cubed" through its first part, "pork belly".

// "Pork belly, raw" -> "pork belly": the part before the first comma, which
// names the food (the rest is usually its state).
const foodName = (name: string) => name.split(",")[0].trim().toLowerCase();

// A whole-food entry matches by its family word ("chicken" in "chicken
// wings"); an exact one by its food name and aliases.
function nameMatchers(avoided: AvoidedIngredient[]): string[] {
  return [
    ...new Set(
      avoided.flatMap((a) => (a.family ? [a.family] : [foodName(a.name), ...a.aliases.map((alias) => alias.trim().toLowerCase())])),
    ),
  ].filter((n) => n.length >= 3);
}

export function useAvoidFilter() {
  const isPro = useIsPro();
  const { prefs } = usePreferences();
  const avoided = useMemo(() => (isPro ? prefs.avoid_ingredients : []), [isPro, prefs.avoid_ingredients]);
  const active = avoided.length > 0;

  const { data: index } = useQuery({
    queryKey: ["meals", "ingredient-index"],
    queryFn: getMealIngredientIndex,
    staleTime: 5 * 60 * 1000,
    enabled: active,
  });

  // Catalog meal id -> whether it uses an avoided ingredient (an exact one,
  // or any in an avoided family; see avoidMatch).
  const hiddenByMeal = useMemo(() => {
    const map = new Map<string, boolean>();
    for (const meal of index ?? []) {
      map.set(
        meal.id,
        meal.meal_ingredients.some((mi) =>
          isCovered(avoided, { id: mi.ingredient_id, canonical_name: mi.ingredient?.canonical_name ?? "", category: mi.ingredient?.category }),
        ),
      );
    }
    return map;
  }, [index, avoided]);

  const names = useMemo(() => nameMatchers(avoided), [avoided]);

  /** True when the meal uses an ingredient the user avoids. */
  const isAvoided = useCallback(
    (meal: Pick<MealType, "id" | "ingredients">) => {
      if (!active) return false;
      const hidden = meal.id != null ? hiddenByMeal.get(String(meal.id)) : undefined;
      if (hidden !== undefined) return hidden;
      return (meal.ingredients ?? []).some((ingredient) => {
        const name = ingredient.name.toLowerCase();
        return names.some((n) => name.includes(n));
      });
    },
    [active, hiddenByMeal, names],
  );

  return { isAvoided, active, avoided };
}
