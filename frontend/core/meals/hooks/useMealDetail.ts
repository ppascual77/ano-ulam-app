import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { getMeal } from "@/api/meals";
import { mealRowToMealType } from "@/frontend/core/meals/utils/mealAdapter";

// Meal Details for a card from a bulk list (no ingredients): fetches the
// full meal on open. `meal` stays null until it arrives, so the sheet
// opens with everything in place.
export function useMealDetail() {
  const [id, setId] = useState<string | null>(null);
  const query = useQuery({
    queryKey: ["meals", "profile-detail", id],
    queryFn: () => getMeal(id as string),
    enabled: !!id,
  });
  const meal = id && query.data ? mealRowToMealType(query.data, query.data.meal_ingredients) : null;
  return { meal, open: (mealId: string | undefined) => setId(mealId ?? null), close: () => setId(null) };
}
