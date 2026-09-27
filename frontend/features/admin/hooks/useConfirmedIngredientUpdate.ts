import { useState } from "react";
import { getMealsUsingIngredients } from "@/api/meals";
import { useUpdateIngredient } from "./useIngredients";
import type { IngredientRow } from "@/api/ingredients";

export type PendingIngredientChange = {
  id: string;
  patch: Partial<IngredientRow>;
  name: string;
};

// Shared confirmation step for every path that can write to the shared
// ingredients table (Manage Ingredients' edit sheet, USDA grounding's batch
// apply, AI Verify's accepted fixes, Seed Meal's "Suggest bridge with AI")
// — surfaces which already-saved meals will have their stored totals
// recomputed BEFORE the write happens, since useUpdateIngredient's cascade
// otherwise does this silently. Takes an array so a batch operation (USDA
// grounding applying several matches at once) gets one combined preview and
// one combined write, not one confirmation per ingredient.
export function useConfirmedIngredientUpdate() {
  const [pending, setPending] = useState<PendingIngredientChange[] | null>(null);
  const [affectedMeals, setAffectedMeals] = useState<{ id: string; name: string }[]>([]);
  const [loadingAffected, setLoadingAffected] = useState(false);
  const updateIngredientMutation = useUpdateIngredient();

  const requestUpdate = async (changes: PendingIngredientChange[]) => {
    if (changes.length === 0) return;
    setPending(changes);
    setLoadingAffected(true);
    try {
      const meals = await getMealsUsingIngredients(changes.map((c) => c.id));
      setAffectedMeals(meals);
    } catch {
      // Best-effort — if the lookup itself fails, don't block the admin
      // from still being able to save; they just won't see the preview.
      setAffectedMeals([]);
    } finally {
      setLoadingAffected(false);
    }
  };

  const confirm = async () => {
    if (!pending) return;
    for (const change of pending) {
      await updateIngredientMutation.mutateAsync({ id: change.id, patch: change.patch });
    }
    setPending(null);
    setAffectedMeals([]);
  };

  const cancel = () => {
    setPending(null);
    setAffectedMeals([]);
  };

  return {
    pending,
    affectedMeals,
    loadingAffected,
    isSaving: updateIngredientMutation.isPending,
    requestUpdate,
    confirm,
    cancel,
  };
}
