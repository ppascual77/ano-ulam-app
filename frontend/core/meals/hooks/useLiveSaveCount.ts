import { useMemo } from "react";
import { useRealMeals } from "./useRealMeals";
import type { MealType } from "../mealTypes";

// How many people saved a meal, read from the live catalog (useRealMeals,
// whose cached count moves right away on the viewer's own save) rather than
// the copy a card or sheet was handed, which may come from another query
// (best value meals) or be a snapshot from when it opened (Meal Details).
export function useLiveSaveCount(meal: MealType): number {
  const { data } = useRealMeals();
  return useMemo(() => {
    const live = meal.id ? data?.find((m) => m.id === meal.id) : undefined;
    return live?.save_count ?? meal.save_count ?? 0;
  }, [data, meal.id, meal.save_count]);
}
