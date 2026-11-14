import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { getMeal } from "@/api/meals";
import { mealRowToMealType } from "@/frontend/core/meals/utils/mealAdapter";
import type { MealType } from "@/frontend/core/meals/mealTypes";

// Meal Details for a card from a bulk list (no ingredients). The sheet opens
// at once with the card's meal (`loading` true: MealDetailSheet shows its
// skeleton, real photo and name), and the full meal takes its place when it
// arrives. Should the fetch fail for good, the card's meal stays.
export function useMealDetail() {
  const [opened, setOpened] = useState<{ id: string; preview: MealType } | null>(null);
  const query = useQuery({
    queryKey: ["meals", "profile-detail", opened?.id ?? null],
    queryFn: () => getMeal(opened!.id),
    enabled: !!opened,
  });
  // Memoized: a new object every render would read as a new meal to the
  // sheet (resetting its related-meals history).
  const full = useMemo(
    () => (opened && query.data ? mealRowToMealType(query.data, query.data.meal_ingredients) : null),
    [opened, query.data],
  );
  return {
    meal: full ?? opened?.preview ?? null,
    loading: !!opened && !full && !query.isError,
    open: (meal: MealType) => setOpened(meal.id ? { id: meal.id, preview: meal } : null),
    close: () => setOpened(null),
  };
}
