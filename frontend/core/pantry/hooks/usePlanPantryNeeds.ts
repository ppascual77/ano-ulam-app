import { useMemo } from "react";
import { useQueries } from "@tanstack/react-query";
import { getMeal } from "@/api/meals";
import { mealRowToMealType } from "@/frontend/core/meals/utils/mealAdapter";
import type { MealType } from "@/frontend/core/meals/mealTypes";
import { usePlannerStore } from "@/frontend/features/meal-planner/store/usePlannerStore";
import type { MealPlan, PlannedMeal } from "@/frontend/features/meal-planner/utils/generatePlan";
import { dayKey } from "../store/useNudgeStore";

const DAY_MS = 86_400_000;
const WEEKDAY = new Intl.DateTimeFormat("en-PH", { weekday: "short" });

/** Real meals with their ingredients, by id (the plan's meals come from the
 *  bulk list, which has none). Same cache as the plan's grocery list. */
export function useMealsWithIngredients(ids: string[], enabled: boolean) {
  const queries = useQueries({
    queries: ids.map((id) => ({
      queryKey: ["meals", "with-ingredients", id],
      queryFn: async () => {
        const row = await getMeal(id);
        return mealRowToMealType(row, row.meal_ingredients);
      },
      enabled,
      staleTime: 5 * 60 * 1000,
    })),
  });
  const stamp = queries.map((q) => q.dataUpdatedAt).join(",");
  const loading = queries.some((q) => q.isLoading);
  const byId = useMemo(() => {
    const map = new Map<string, MealType>();
    queries.forEach((q, i) => q.data && map.set(ids[i], q.data));
    return map;
    // Re-derive when any fetch lands.
  }, [ids.join(","), stamp]);
  return { byId, loading };
}

/** The plan's days on and after today, each meal with its day. */
function upcoming(plan: MealPlan | null, now: Date) {
  if (!plan) return [];
  const today = dayKey(now);
  return plan.days.flatMap((day) => {
    const date = new Date(day.date);
    return dayKey(date) >= today ? day.meals.map((planned) => ({ planned, date })) : [];
  });
}

function whenLabel(planned: PlannedMeal, date: Date, now: Date) {
  const days = Math.round((new Date(dayKey(date)).getTime() - new Date(dayKey(now)).getTime()) / DAY_MS);
  if (days <= 0) return planned.slot === "dinner" ? "tonight" : "later today";
  if (days === 1) return "tomorrow";
  return `on ${WEEKDAY.format(date)}`;
}

/**
 * Pantry items a planned meal from today on still needs, by ingredient id,
 * with the note that says so ("Still needed for Chicken Tinola tonight"):
 * cooking one meal shouldn't empty the chicken bought for two.
 */
export function useLaterPlanNeeds(enabled: boolean) {
  const plan = usePlannerStore((s) => s.plan);
  const later = useMemo(() => upcoming(plan, new Date()), [plan]);
  const ids = useMemo(() => [...new Set(later.map(({ planned }) => planned.meal.id as string).filter(Boolean))], [later]);
  const { byId, loading } = useMealsWithIngredients(ids, enabled);
  const needs = useMemo(() => {
    const now = new Date();
    const map = new Map<string, string>();
    for (const { planned, date } of later) {
      const meal = byId.get(planned.meal.id as string);
      for (const ingredient of meal?.ingredients ?? []) {
        if (ingredient.ingredientId && !map.has(ingredient.ingredientId)) {
          map.set(ingredient.ingredientId, `Still needed for ${meal?.name ?? planned.meal.name} ${whenLabel(planned, date, now)}`);
        }
      }
    }
    return map;
  }, [later, byId]);
  return { needs, loading };
}
