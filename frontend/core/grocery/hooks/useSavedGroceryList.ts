import { useMemo } from "react";
import { useGroceryMealsStore } from "../store/useGroceryMealsStore";
import { buildGroceryList } from "../utils/buildGroceryList";
import { applyStaplesToBuy, useStaplesToBuy } from "../store/useStaplesToBuyStore";
import { useGroceryChecks } from "./useGroceryChecks";
import { useSavedMealsForGrocery } from "./useSavedMealsForGrocery";
import type { GroceryMealPickerData } from "../components/GroceryMealPicker";

// The saved-meals grocery list (rebuilt from the saved meals on the list
// whenever they change; Profile's Grocery tab and the grocery sheet's "Saved
// meals" tab) plus its checkboxes (useGroceryChecks, the "saved" list) and
// what the sheet's meal picker needs: every cookable saved meal, which are
// on, and how much of each one's shopping is picked up.
export function useSavedGroceryList(userId: string | null) {
  const saved = useSavedMealsForGrocery(userId);
  const checks = useGroceryChecks("saved", userId);
  const staplesToBuy = useStaplesToBuy();
  const items = useMemo(() => applyStaplesToBuy(buildGroceryList(saved.onList), staplesToBuy), [saved.onList, staplesToBuy]);

  const total = items.reduce((sum, item) => (item.category === "main" ? sum + item.price : sum), 0);

  // Per meal on the list: the share of its "To buy" ingredients checked off
  // (null: it needs nothing from the store). Items merge by lowercased name,
  // the same key buildGroceryList uses.
  const { isChecked } = checks;
  const progress = useMemo(() => {
    const toBuy = new Map(items.filter((item) => item.category === "main").map((item) => [item.id, item]));
    const map = new Map<string, number | null>();
    for (const meal of saved.onList) {
      const ids = new Set((meal.ingredients ?? []).map((ingredient) => ingredient.name.trim().toLowerCase()));
      const mine = [...ids].map((id) => toBuy.get(id)).filter((item) => item != null);
      map.set(meal.saved_id, mine.length === 0 ? null : mine.filter(isChecked).length / mine.length);
    }
    return map;
  }, [items, saved.onList, isChecked]);

  const toggleMeal = useGroceryMealsStore((s) => s.toggle);
  const picker: GroceryMealPickerData = {
    meals: saved.meals,
    off: saved.off,
    progress,
    onToggle: (savedId) => toggleMeal(userId, savedId),
  };

  return {
    items,
    total,
    loading: saved.isLoading || checks.loading,
    isChecked,
    toggle: checks.toggle,
    flush: checks.flush,
    picker,
  };
}
