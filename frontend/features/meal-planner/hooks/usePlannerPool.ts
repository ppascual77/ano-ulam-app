import { useMemo } from "react";
import { usePreferredMeals } from "@/frontend/core/meals/hooks/usePreferredMeals";
import { mealTimesOf } from "@/frontend/core/meals/utils/mealTimes";
import { scaleMeal } from "@/frontend/core/meals/utils/scaleMeal";
import type { PlannerMeal } from "../utils/generatePlan";

// The meals the planner picks from: the real catalog, following the user's
// preferences (no allergens, their dietary focus). Home-cooked only (the
// plan is cooked at home), and each meal fills the slots its meal-time tags
// say (breakfast, lunch, dinner); an untagged meal isn't planned.
export function usePlannerPool() {
  const { meals, isLoading } = usePreferredMeals();
  const pool = useMemo<PlannerMeal[]>(
    () =>
      meals
        .filter((meal) => meal.category !== "fast_food")
        .flatMap((meal) => {
          const slots = mealTimesOf(meal.tags);
          // Catalog meals store totals for the whole recipe (serving_size
          // servings); the planner works per person, so one serving each.
          return slots.length > 0 ? [{ ...scaleMeal(meal, 1), slots }] : [];
        }),
    [meals],
  );
  return { pool, isLoading };
}
