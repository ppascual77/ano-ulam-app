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
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "ingredients"] });
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
