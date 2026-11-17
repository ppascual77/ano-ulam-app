import { useMemo } from "react";
import { usePantry } from "@/frontend/core/pantry/hooks/usePantry";
import { buildGroceryList } from "../utils/buildGroceryList";
import { inPantry } from "../utils/groupGroceryItems";
import { useSavedMealsForGrocery } from "./useSavedMealsForGrocery";
import type { GroceryMealPickerData } from "../components/GroceryMealPicker";

// The saved-meals grocery list: every saved home-cooked meal's ingredients,
// rebuilt whenever the saves change (Profile's Grocery tab and the grocery
// sheet's "Saved meals" tab). Saved means "cooking this": the morning nudge
// unsaves a meal once it's cooked. Plus the photo row: each saved meal and
// how much of its shopping is already in the pantry.
export function useSavedGroceryList() {
  const saved = useSavedMealsForGrocery();
  const { data: pantry = [] } = usePantry();
  const items = useMemo(() => buildGroceryList(saved.meals), [saved.meals]);

  const total = items.reduce((sum, item) => (item.category === "main" ? sum + item.price : sum), 0);

  // Per meal: the share of its main ingredients in the pantry (null: it
  // needs nothing from the store). Items merge by lowercased name, the same
  // key buildGroceryList uses.
  const progress = useMemo(() => {
    const mains = new Map(items.filter((item) => item.category === "main").map((item) => [item.id, item]));
    const map = new Map<string, number | null>();
    for (const meal of saved.meals) {
      const ids = new Set((meal.ingredients ?? []).map((ingredient) => ingredient.name.trim().toLowerCase()));
      const mine = [...ids].map((id) => mains.get(id)).filter((item) => item != null);
      map.set(meal.saved_id, mine.length === 0 ? null : mine.filter((item) => inPantry(pantry, item)).length / mine.length);
    }
    return map;
  }, [items, saved.meals, pantry]);

  const picker: GroceryMealPickerData = { meals: saved.meals, progress };

  return { items, total, loading: saved.isLoading, picker };
}
