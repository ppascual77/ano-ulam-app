import { useMemo } from "react";
import { usePlannerStore } from "@/frontend/features/meal-planner/store/usePlannerStore";
import type { MealSlot } from "@/frontend/features/meal-planner/utils/generatePlan";
import { dayKey, useCooked } from "../store/useCookedStore";
import { usePantry } from "./usePantry";
import { useMealsWithIngredients } from "./usePlanPantryNeeds";
import type { UsedUpMeal } from "../usedUp";

const DAY_MS = 86_400_000;
// Skipped this many times in a row: ask once a week instead of daily.
const SKIPS_BEFORE_WEEKLY = 3;
const WEEK_DAYS = 7;

export type NudgeMeal = UsedUpMeal & { id: string; slot: MealSlot };

/**
 * Home's "Cooked any of these?": yesterday's planned meals that weren't
 * finished through Start Cooking and used something in the pantry. Once a
 * day (answered or skipped), weekly after three skips in a row, and only
 * with a meal plan (saved meals have no day to ask about).
 */
export function useMorningNudge() {
  const plan = usePlannerStore((s) => s.plan);
  const cooked = useCooked();
  const { data: pantry = [] } = usePantry();

  const now = new Date();
  const today = dayKey(now);
  const yesterday = dayKey(new Date(now.getTime() - DAY_MS));
  const sinceAnswered = cooked.answeredDay
    ? Math.round((new Date(today).getTime() - new Date(cooked.answeredDay).getTime()) / DAY_MS)
    : Infinity;
  const due =
    cooked.loaded &&
    cooked.answeredDay !== today &&
    !(cooked.skipStreak >= SKIPS_BEFORE_WEEKLY && sinceAnswered < WEEK_DAYS) &&
    pantry.length > 0;

  const day = plan?.days.find((d) => dayKey(new Date(d.date)) === yesterday);
  const { pending, done } = useMemo(() => {
    const pending: { id: string; slot: MealSlot; name: string }[] = [];
    const done: string[] = [];
    const seen = new Set<string>();
    for (const { slot, meal } of day?.meals ?? []) {
      const id = meal.id as string | undefined;
      if (!id || seen.has(id)) continue;
      seen.add(id);
      if (cooked.cooked.includes(`${yesterday}|${id}`)) done.push(meal.name);
      else pending.push({ id, slot, name: meal.name });
    }
    return { pending, done };
  }, [day, cooked.cooked, yesterday]);

  const ids = useMemo(() => pending.map((m) => m.id), [pending]);
  const { byId, loading } = useMealsWithIngredients(ids, due && ids.length > 0);

  const meals: NudgeMeal[] = useMemo(() => {
    const have = new Set(pantry.map((p) => p.id));
    return pending.flatMap(({ id, slot, name }) => {
      const ingredients = byId.get(id)?.ingredients ?? [];
      // Nothing of it in the pantry: nothing to take out, so not asked.
      if (!ingredients.some((i) => i.ingredientId && have.has(i.ingredientId))) return [];
      return [{ key: id, id, slot, name, ingredients }];
    });
  }, [pending, byId, pantry]);

  return { visible: due && !loading && meals.length > 0, meals, done, answer: cooked.answer };
}
