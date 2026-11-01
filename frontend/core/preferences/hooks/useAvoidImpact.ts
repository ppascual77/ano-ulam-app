import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { getMealIngredientIndex } from "@/api/meals";
import type { AvoidedIngredient } from "@/api/auth";
import { entryMatches } from "../avoidMatch";

// What a list of ingredients to avoid takes out of the catalog: how many
// meals it hides in all, and how many each entry hides (an exact ingredient,
// or a whole food). From the same meal -> ingredients index and matcher as
// useAvoidFilter (shared and cached), so the numbers match what's hidden.
export function useAvoidImpact(entries: AvoidedIngredient[]) {
  const { data: index, isLoading } = useQuery({
    queryKey: ["meals", "ingredient-index"],
    queryFn: getMealIngredientIndex,
    staleTime: 5 * 60 * 1000,
  });

  return useMemo(() => {
    const perEntry = new Map<string, number>();
    let hidden = 0;
    for (const meal of index ?? []) {
      const ingredients = meal.meal_ingredients.map((mi) => ({
        id: mi.ingredient_id,
        canonical_name: mi.ingredient?.canonical_name ?? "",
        category: mi.ingredient?.category,
      }));
      let any = false;
      for (const entry of entries) {
        if (ingredients.some((ing) => entryMatches(entry, ing))) {
          any = true;
          perEntry.set(entry.id, (perEntry.get(entry.id) ?? 0) + 1);
        }
      }
      if (any) hidden++;
    }
    return { hidden, total: index?.length ?? 0, perEntry, loading: isLoading };
  }, [index, isLoading, entries]);
}
