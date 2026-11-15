import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { getIngredientRoles } from "@/api/ingredients";
import { useSavedMeals } from "@/frontend/core/saved/hooks/useSavedMeals";

// The saved meals the grocery list is built from, with each ingredient's
// role (main vs pantry staple) taken from the ingredients table rather than
// the saved snapshot, which keeps whatever the role was on the day the meal
// was saved. So a retagged ingredient moves between "To buy" and "Pantry
// staples" in lists of meals saved before the change. A role that was never
// set counts as main: better an extra row to tick off than something you
// need hidden among the staples. Until the roles load (or if they fail),
// the snapshot's roles are used.
export function useSavedMealsForGrocery() {
  const saved = useSavedMeals();
  const ids = useMemo(() => {
    const set = new Set<string>();
    for (const meal of saved.data ?? []) for (const ingredient of meal.ingredients ?? []) if (ingredient.ingredientId) set.add(ingredient.ingredientId);
    return [...set].sort();
  }, [saved.data]);
  const roles = useQuery({
    queryKey: ["ingredients", "roles", ids],
    queryFn: () => getIngredientRoles(ids),
    enabled: ids.length > 0,
    staleTime: 10 * 60 * 1000,
  });
  const meals = useMemo(() => {
    const current = roles.data;
    if (!current) return saved.data ?? [];
    return (saved.data ?? []).map((meal) => ({
      ...meal,
      ingredients: meal.ingredients?.map((ingredient) =>
        ingredient.ingredientId && ingredient.ingredientId in current
          ? { ...ingredient, type: current[ingredient.ingredientId] === "pantry" ? ("pantry" as const) : ("main" as const) }
          : ingredient,
      ),
    }));
  }, [saved.data, roles.data]);
  return { meals, isLoading: saved.isLoading };
}
