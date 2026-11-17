import { useMemo } from "react";
import { useSavedMealsForGrocery } from "@/frontend/core/grocery/hooks/useSavedMealsForGrocery";
import type { SavedMeal } from "@/frontend/core/saved/types";
import { dayKey, daysBetween, useNudge } from "../store/useNudgeStore";
import { usePantry } from "./usePantry";
import type { UsedUpMeal } from "../usedUp";

// Skipped this many times in a row: ask every few days instead of daily.
const SKIPS_BEFORE_BACKOFF = 3;
const BACKOFF_DAYS = 3;
// Saved at least this long ago: probably cooked by now, so it starts ticked.
const LIKELY_COOKED_DAYS = 3;

export type NudgeMeal = UsedUpMeal & {
  saved: SavedMeal;
  /** Starts ticked: saved a while ago. */
  likely: boolean;
  /** "Saved 4 days ago". */
  savedLabel: string;
};

function savedLabel(age: number): string {
  if (age <= 0) return "Saved today";
  if (age === 1) return "Saved yesterday";
  return `Saved ${age} days ago`;
}

/**
 * Home's "Cooked any of your saved meals?": saved means "cooking this", so
 * this asks which ones got cooked, then takes them off the list (unsaves
 * them) and what they used up out of the pantry. Only saved meals that use
 * something in the pantry (nothing to take out otherwise). Once a day
 * (answered or skipped); after three skips in a row, every three days.
 * Meal plan days tidy the pantry on their own (usePlanDayCleanup).
 */
export function useMorningNudge() {
  const nudge = useNudge();
  const { meals: saved } = useSavedMealsForGrocery();
  const { data: pantry = [] } = usePantry();

  const today = dayKey(new Date());
  // A day after today means the phone's clock went back (or was set ahead
  // to test): not a real answer, so it doesn't hold the nudge back.
  const answeredDay = nudge.answeredDay && nudge.answeredDay <= today ? nudge.answeredDay : null;
  const backedOff = nudge.skipStreak >= SKIPS_BEFORE_BACKOFF && answeredDay != null && daysBetween(answeredDay, today) < BACKOFF_DAYS;
  const due = nudge.loaded && answeredDay !== today && !backedOff;

  const meals: NudgeMeal[] = useMemo(() => {
    const have = new Set(pantry.map((p) => p.id));
    return saved.flatMap((meal) => {
      const ingredients = meal.ingredients ?? [];
      if (!ingredients.some((i) => i.ingredientId && have.has(i.ingredientId))) return [];
      const age = daysBetween(dayKey(new Date(meal.date_saved)), today);
      return [{ key: meal.saved_id, name: meal.name, ingredients, saved: meal, likely: age >= LIKELY_COOKED_DAYS, savedLabel: savedLabel(age) }];
    });
  }, [saved, pantry, today]);

  return { visible: due && meals.length > 0, meals, answer: nudge.answer };
}
