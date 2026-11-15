import { useMemo } from "react";
import { useSavedMealsForGrocery } from "./useSavedMealsForGrocery";
import { buildGroceryList } from "../utils/buildGroceryList";
import { applyStaplesToBuy, useStaplesToBuy } from "../store/useStaplesToBuyStore";
import { useGroceryChecks } from "./useGroceryChecks";

// The saved-meals grocery list (rebuilt from saved meals whenever they
// change; Profile's Grocery tab and the grocery sheet's "Saved meals" tab)
// plus its checkboxes (useGroceryChecks, the "saved" list).
export function useSavedGroceryList(userId: string | null) {
  const saved = useSavedMealsForGrocery();
  const checks = useGroceryChecks("saved", userId);
  const staplesToBuy = useStaplesToBuy();
  const items = useMemo(
    () => applyStaplesToBuy(buildGroceryList(saved.meals), staplesToBuy),
    [saved.meals, staplesToBuy],
  );

  const total = items.reduce((sum, item) => (item.category === "main" ? sum + item.price : sum), 0);
  return {
    items,
    total,
    loading: saved.isLoading || checks.loading,
    isChecked: checks.isChecked,
    toggle: checks.toggle,
    flush: checks.flush,
  };
}
