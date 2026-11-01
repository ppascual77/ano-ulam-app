import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { getMealIngredientIndex } from "@/api/meals";

// What a list of ingredients to avoid takes out of the catalog: how many
// meals it hides in all, and how many use each ingredient. From the same
// meal -> ingredients index as useAvoidFilter and Suggest by Pantry (shared
// and cached), so the numbers match what's actually hidden.
export function useAvoidImpact(ids: string[]) {
  const { data: index, isLoading } = useQuery({
    queryKey: ["meals", "ingredient-index"],
    queryFn: getMealIngredientIndex,
    staleTime: 5 * 60 * 1000,
  });

  return useMemo(() => {
    const wanted = new Set(ids);
    const perIngredient = new Map<string, number>();
    let hidden = 0;
    for (const meal of index ?? []) {
      const uses = new Set(meal.meal_ingredients.map((mi) => mi.ingredient_id).filter((id) => wanted.has(id)));
      if (uses.size > 0) hidden++;
      for (const id of uses) perIngredient.set(id, (perIngredient.get(id) ?? 0) + 1);
    }
    return { hidden, total: index?.length ?? 0, perIngredient, loading: isLoading };
  }, [index, isLoading, ids]);
}
