import { useMemo } from "react";
import { usePantry } from "@/frontend/core/pantry/hooks/usePantry";
import { useSavedMealsForGrocery } from "./useSavedMealsForGrocery";
import { buildGroceryList } from "../utils/buildGroceryList";
import { groupGroceryItems } from "../utils/groupGroceryItems";

// How many ingredients of the saved meals are still to buy (not in the
// pantry), for Home's cart badge.
export function useGroceryToBuyCount() {
  const saved = useSavedMealsForGrocery();
  const { data: pantry = [] } = usePantry();
  return useMemo(() => groupGroceryItems(buildGroceryList(saved.meals), pantry).toBuy.length, [saved.meals, pantry]);
}
