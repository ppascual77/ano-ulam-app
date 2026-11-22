import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { getIngredientRoles } from "@/api/ingredients";
import { useLockedSaves, useSavedMeals } from "@/frontend/core/saved/hooks/useSavedMeals";
import type { SavedMeal } from "@/frontend/core/saved/types";

// The saved meals the grocery list is built from: home-cooked ones (fast
// food has no ingredients to buy), each ingredient's role (main vs pantry
// staple) taken from the ingredients table rather than the saved snapshot,
// which keeps whatever the role was on the day the meal was saved. So a
// retagged ingredient moves between "To buy" and "Pantry staples" in lists
// of meals saved before the change. A role that was never set counts as
// main: better an extra row to tick off than something you need hidden
// among the staples. Until the roles load (or if they fail), the snapshot's
// roles are used. Every saved meal is on the list (saved means cooking it),
// except saves locked after Pro ended.
export function useSavedMealsForGrocery() {
  const saved = useSavedMeals();
  // Saves locked after Pro ended (useLockedSaves) aren't on the list.
  const locked = useLockedSaves();
  const cookable = useMemo(
    () => (saved.data ?? []).filter((meal) => meal.category !== "fast_food" && !locked.has(meal.saved_id)),
    [saved.data, locked],
  );
  const ids = useMemo(() => {
    const set = new Set<string>();
    for (const meal of cookable) for (const ingredient of meal.ingredients ?? []) if (ingredient.ingredientId) set.add(ingredient.ingredientId);
    return [...set].sort();
  }, [cookable]);
  const roles = useQuery({
    queryKey: ["ingredients", "roles", ids],
    queryFn: () => getIngredientRoles(ids),
    enabled: ids.length > 0,
    staleTime: 10 * 60 * 1000,
  });
  const meals: SavedMeal[] = useMemo(() => {
    const current = roles.data;
    if (!current) return cookable;
    return cookable.map((meal) => ({
      ...meal,
      ingredients: meal.ingredients?.map((ingredient) =>
        ingredient.ingredientId && ingredient.ingredientId in current
          ? { ...ingredient, type: current[ingredient.ingredientId] === "pantry" ? ("pantry" as const) : ("main" as const) }
          : ingredient,
      ),
    }));
  }, [cookable, roles.data]);
  return { meals, isLoading: saved.isLoading };
}
