import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  addMealIngredient,
  archiveMeal,
  createMeal,
  deleteMealIngredient,
  getIngredientsForMatching,
  getMeal,
  getMeals,
  importMealFromUrl,
  recomputeMealTotals,
  replaceMealIngredients,
  updateMeal,
  updateMealIngredient,
  uploadMealImage,
  type MealFilters,
  type MealIngredientInput,
  type MealIngredientRow,
  type MealRow,
} from "@/api/meals";

const mealKeys = {
  list: (filters: MealFilters) => ["admin", "meals", filters] as const,
  detail: (id: string) => ["admin", "meals", "detail", id] as const,
  matchable: ["admin", "meals", "matchable-ingredients"] as const,
};

export function useMeals(filters: MealFilters) {
  return useQuery({
    queryKey: mealKeys.list(filters),
    queryFn: () => getMeals(filters),
  });
}

export function useMeal(id: string | null) {
  return useQuery({
    queryKey: mealKeys.detail(id ?? ""),
    queryFn: () => getMeal(id as string),
    enabled: !!id,
  });
}

// The ~500-row ingredients table, fetched once for client-side matching
// (see api/meals.ts's matchIngredientCandidates) rather than re-querying
// per keystroke.
export function useIngredientsForMatching() {
  return useQuery({
    queryKey: mealKeys.matchable,
    queryFn: getIngredientsForMatching,
    staleTime: 5 * 60 * 1000,
  });
}

export function useImportMealFromUrl() {
  return useMutation({
    mutationFn: (url: string) => importMealFromUrl(url),
  });
}

export function useCreateMeal() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (patch: Partial<MealRow> & { name: string }) => createMeal(patch),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "meals"] });
    },
  });
}

export function useUpdateMeal() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: Partial<MealRow> }) => updateMeal(id, patch),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "meals"] });
    },
  });
}

export function useArchiveMeal() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => archiveMeal(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "meals"] });
    },
  });
}

export function useAddMealIngredient() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ mealId, input }: { mealId: string; input: MealIngredientInput }) =>
      addMealIngredient(mealId, input),
    onSuccess: (_data, { mealId }) => {
      queryClient.invalidateQueries({ queryKey: mealKeys.detail(mealId) });
    },
  });
}

export function useUpdateMealIngredient() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: Partial<MealIngredientRow> }) =>
      updateMealIngredient(id, patch),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "meals"] });
    },
  });
}

export function useDeleteMealIngredient() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteMealIngredient(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "meals"] });
    },
  });
}

export function useRecomputeMealTotals() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (mealId: string) => recomputeMealTotals(mealId),
    onSuccess: (_data, mealId) => {
      queryClient.invalidateQueries({ queryKey: mealKeys.detail(mealId) });
      queryClient.invalidateQueries({ queryKey: ["admin", "meals"] });
    },
  });
}

export function useReplaceMealIngredients() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ mealId, inputs }: { mealId: string; inputs: MealIngredientInput[] }) =>
      replaceMealIngredients(mealId, inputs),
    onSuccess: (_data, { mealId }) => {
      queryClient.invalidateQueries({ queryKey: mealKeys.detail(mealId) });
    },
  });
}

export function useUploadMealImage() {
  return useMutation({
    mutationFn: ({ localUri, mealId }: { localUri: string; mealId: string }) =>
      uploadMealImage(localUri, mealId),
  });
}
