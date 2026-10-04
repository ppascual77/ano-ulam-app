import { useMemo } from "react";
import { useRealMeals } from "@/frontend/core/meals/hooks/useRealMeals";
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
    if (PLAN_WITH_REAL_MEALS_ONLY) {
      return (realMeals ?? []).map((meal) => ({ ...meal, slots: ["breakfast", "lunch", "dinner"] as PlannerMeal["slots"] }));
    }
    const real = (realMeals ?? [])
      .filter((meal) => meal.category !== "fast_food")
      .filter((meal) => Number(meal.price) / (meal.serving_size ?? 1) <= REAL_MEAL_MAX_PER_SERVING)
      .map((meal) => ({ ...meal, slots: ["lunch", "dinner"] as PlannerMeal["slots"] }));
    return [...PLANNER_MEALS, ...real];
  }, [realMeals]);
  return { pool, isLoading };
}
