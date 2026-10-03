import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { getMeal } from "@/api/meals";
import { approveRecipe, getPendingRecipes, rejectRecipe } from "@/api/recipes";

const recipeKeys = {
  pending: ["admin", "recipes", "pending"] as const,
  detail: (id: string) => ["admin", "recipes", "detail", id] as const,
};

export function usePendingRecipes() {
  return useQuery({ queryKey: recipeKeys.pending, queryFn: getPendingRecipes });
}

export function useRecipeForReview(id: string | null) {
  return useQuery({
    queryKey: recipeKeys.detail(id ?? ""),
    queryFn: () => getMeal(id as string),
    enabled: !!id,
  });
}

// Every review action changes what the pending list, the open recipe, and
// (on approve) the public catalog show, so all three refetch.
function useInvalidateAfterReview() {
  const queryClient = useQueryClient();
  return (mealId: string) => {
    queryClient.invalidateQueries({ queryKey: recipeKeys.pending });
    queryClient.invalidateQueries({ queryKey: recipeKeys.detail(mealId) });
    queryClient.invalidateQueries({ queryKey: ["meals"] });
    queryClient.invalidateQueries({ queryKey: ["admin", "meals"] });
  };
}

export function useApproveRecipe() {
  const invalidate = useInvalidateAfterReview();
  return useMutation({
    mutationFn: (mealId: string) => approveRecipe(mealId),
    onSuccess: (_data, mealId) => invalidate(mealId),
  });
}

export function useRejectRecipe() {
  const invalidate = useInvalidateAfterReview();
  return useMutation({
    mutationFn: (input: { mealId: string; reason: string }) => rejectRecipe(input.mealId, input.reason),
    onSuccess: (_data, input) => invalidate(input.mealId),
  });
}
