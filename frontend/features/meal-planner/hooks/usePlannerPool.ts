import { useMemo } from "react";
import { useRealMeals } from "@/frontend/core/meals/hooks/useRealMeals";
import { PLANNER_MEALS, type PlannerMeal } from "../mock/plannerMeals";

// Real catalog meals join the planner's pool as lunch/dinner options:
// home-cooked only (the plan is cooked at home), and only when one serving
// costs no more than this, so they can actually fit a typical budget.
const REAL_MEAL_MAX_PER_SERVING = 150;

// The meals the planner picks from: its mock catalog plus fitting real
// meals. Real ones have photos and full recipes behind "View Recipe".
export function usePlannerPool() {
  const { data: realMeals, isLoading } = useRealMeals();
  const pool = useMemo<PlannerMeal[]>(() => {
    const real = (realMeals ?? [])
      .filter((meal) => meal.category !== "fast_food")
      .filter((meal) => Number(meal.price) / (meal.serving_size ?? 1) <= REAL_MEAL_MAX_PER_SERVING)
      .map((meal) => ({ ...meal, slots: ["lunch", "dinner"] as PlannerMeal["slots"] }));
    return [...PLANNER_MEALS, ...real];
  }, [realMeals]);
  return { pool, isLoading };
}
