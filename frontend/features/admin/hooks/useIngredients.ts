import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  archiveIngredient,
  getIngredients,
  groundIngredientsUsda,
  markUsdaGroundingAttempted,
  updateIngredient,
  type IngredientFilters,
  type IngredientRow,
} from "@/api/ingredients";
import { recomputeMealsUsingIngredient } from "@/api/meals";
import { adminKeys } from "../queryKeys";

export function useIngredients(filters: IngredientFilters) {
  return useQuery({
    queryKey: adminKeys.ingredients(filters),
    queryFn: () => getIngredients(filters),
  });
}

export function useUpdateIngredient() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: Partial<IngredientRow> }) =>
      updateIngredient(id, patch),
    onSuccess: async (_data, { id }) => {
      queryClient.invalidateQueries({ queryKey: ["admin", "ingredients"] });
      // Every meal built on this ingredient has its own cached
      // calories/protein/carbohydrates/fat/price — without this, editing
      // an ingredient (a manual correction, a re-ground, applying a USDA
      // match) would leave those meals silently showing stale numbers.
      await recomputeMealsUsingIngredient(id);
      queryClient.invalidateQueries({ queryKey: ["admin", "meals"] });
    },
  });
}

export function useArchiveIngredient() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => archiveIngredient(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "ingredients"] });
    },
  });
}

export function useGroundIngredientsUsda() {
  return useMutation({
    mutationFn: (ingredients: { id: string; canonicalName: string }[]) =>
      groundIngredientsUsda(ingredients),
  });
}

export function useMarkUsdaGroundingAttempted() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (ids: string[]) => markUsdaGroundingAttempted(ids),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "ingredients"] });
    },
  });
}
