import { useMemo } from "react";
import { useRealMeals } from "@/frontend/core/meals/hooks/useRealMeals";
import { scaleMeal } from "@/frontend/core/meals/utils/scaleMeal";
import { PLANNER_MEALS, type PlannerMeal } from "../mock/plannerMeals";

// Real catalog meals join the planner's pool as lunch/dinner options:
// home-cooked only (the plan is cooked at home), and only when one serving
// costs no more than this, so they can actually fit a typical budget.
const REAL_MEAL_MAX_PER_SERVING = 150;

// TEMP (design preview): plan with the real meals table only, to see real
// photos and data. The table is tiny (a few meals, no breakfasts, ₱110+),
// so every meal may fill any slot and the budget isn't enforced (see
// MealPlannerScreen). Set to false to go back to the mock catalog + fitting
// real meals.
export const PLAN_WITH_REAL_MEALS_ONLY = true;

// The meals the planner picks from: its mock catalog plus fitting real
// meals. Real ones have photos and full recipes behind "View Recipe".
export function usePlannerPool() {
  const { data: realMeals, isLoading } = useRealMeals();
  const pool = useMemo<PlannerMeal[]>(() => {
    // Real meals store totals for the whole recipe (serving_size servings);
    // the planner works per person, so each is scaled to one serving first.
    const oneServing = (realMeals ?? []).map((meal) => scaleMeal(meal, 1));
    if (PLAN_WITH_REAL_MEALS_ONLY) {
      return oneServing.map((meal) => ({ ...meal, slots: ["breakfast", "lunch", "dinner"] as PlannerMeal["slots"] }));
    }
    const real = oneServing
      .filter((meal) => meal.category !== "fast_food")
      .filter((meal) => Number(meal.price) <= REAL_MEAL_MAX_PER_SERVING)
      .map((meal) => ({ ...meal, slots: ["lunch", "dinner"] as PlannerMeal["slots"] }));
    return [...PLANNER_MEALS, ...real];
  }, [realMeals]);
  return { pool, isLoading };
}
