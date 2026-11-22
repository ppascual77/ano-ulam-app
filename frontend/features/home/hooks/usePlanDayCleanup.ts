import { useEffect, useMemo, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { getMealPlan } from "@/api/mealPlans";
import { useSavedMealsForGrocery } from "@/frontend/core/grocery/hooks/useSavedMealsForGrocery";
import { usePantry, usePantryActions } from "@/frontend/core/pantry/hooks/usePantry";
import { useLaterPlanNeeds, useMealsWithIngredients } from "@/frontend/core/pantry/hooks/usePlanPantryNeeds";
import { dayKey, useNudge } from "@/frontend/core/pantry/store/useNudgeStore";
import { addAlsoIn, surelyUsedUp } from "@/frontend/core/pantry/usedUp";
import { useAuth } from "@/frontend/features/auth/hooks/useAuth";
import { planKey } from "@/frontend/features/meal-planner/hooks/useSavedMealPlan";
import { SLOTS, planDates } from "@/frontend/features/meal-planner/utils/generatePlan";

const DAY_MS = 86_400_000;
// A first run (or a long break) only looks back this far, so an old plan
// doesn't empty the pantry the day this ships.
const LOOK_BACK_DAYS = 2;
const WEEKDAY = new Intl.DateTimeFormat("en-PH", { weekday: "long" });

/** Whose plan a cleanup belongs to: the account and the plan's start. */
const cleanupOwner = (userId: string, planStart: string) => `${userId}|${planStart}`;

/** The saved plan's days that have ended since the last cleanup, with their
 *  meal ids. Read from the saved row, not the planner, which drops a plan
 *  once its last day is over (and that day still needs cleaning). The last
 *  cleanup only counts if it was this account's and this plan's. */
function usePastPlanDays(cleaned: { through: string | null; for: string | null }, enabled: boolean) {
  const userId = useAuth().session?.user.id ?? null;
  const saved = useQuery({ queryKey: planKey(userId), queryFn: getMealPlan, enabled: !!userId && enabled });
  const owner = userId && saved.data ? cleanupOwner(userId, saved.data.start_date) : null;
  // A record from before owners were kept counts as before (no owner yet),
  // so a day someone undid isn't cleaned a second time after the update.
  const since = cleaned.for == null || cleaned.for === owner ? cleaned.through : null;
  const days = useMemo(() => {
    const row = saved.data;
    if (!row || !Array.isArray(row.days)) return [];
    const today = dayKey(new Date());
    // A cleanup "after today" means the clock went back: look back as usual.
    const floor = since && since < today ? since : dayKey(new Date(Date.now() - LOOK_BACK_DAYS * DAY_MS));
    const [y, m, d] = row.start_date.split("-").map(Number);
    const dates = planDates(new Date(y, m - 1, d), row.days.length);
    return row.days.flatMap((entry, i) => {
      const day = dayKey(dates[i]);
      if (day >= today || day <= floor || !entry || typeof entry !== "object" || Array.isArray(entry)) return [];
      const slots = entry as Record<string, unknown>;
      const ids = SLOTS.map((slot) => slots[slot]).filter((id): id is string => typeof id === "string");
      return [{ day, date: dates[i], ids }];
    });
  }, [saved.data, since]);
  return { days, planStart: saved.data?.start_date ?? null, owner };
}

/**
 * Meal plan days clean up on their own: once a day is over, what its meals
 * surely finished (loose mains, never packs or basics) comes out of the
 * pantry, except anything a planned meal from today on or a saved meal
 * still needs. Home's header line says what went for 12 hours, with Undo
 * for "I didn't actually cook that" (HomeTicker). Each day once
 * (useNudgeStore's cleanedThrough).
 */
export function usePlanDayCleanup(enabled: boolean) {
  const nudge = useNudge();
  const pantry = usePantry();
  const pantryActions = usePantryActions();
  const saved = useSavedMealsForGrocery();
  const { days: past, planStart, owner } = usePastPlanDays(
    { through: nudge.cleanedThrough, for: nudge.cleanedFor },
    enabled && nudge.loaded,
  );
  const ids = useMemo(() => [...new Set(past.flatMap((d) => d.ids))], [past]);
  const active = enabled && nudge.loaded && ids.length > 0;
  const meals = useMealsWithIngredients(ids, active);
  const later = useLaterPlanNeeds(active);
  const ran = useRef(false);

  useEffect(() => {
    if (!active || ran.current) return;
    if (!pantry.isSuccess || saved.isLoading || meals.loading || later.loading) return;
    ran.current = true;
    const lastDay = past[past.length - 1].day;
    const keep = addAlsoIn(
      new Map(later.needs),
      saved.meals.map((meal) => ({ key: meal.saved_id, name: meal.name, ingredients: meal.ingredients ?? [] })),
    );
    const cooked = ids.flatMap((id) => {
      const meal = meals.byId.get(id);
      return meal ? [{ key: id, name: meal.name, ingredients: meal.ingredients ?? [] }] : [];
    });
    const usedUp = surelyUsedUp(cooked, pantry.data ?? [], keep).map(({ id, name }) => ({ id, name }));
    if (owner) nudge.markCleaned(lastDay, owner);
    if (usedUp.length === 0) return;
    pantryActions.removeMany(usedUp.map((item) => item.id));
    const when = past.length === 1 ? `${WEEKDAY.format(past[0].date)}'s plan` : "Your past plan days";
    nudge.setCleanupNote({ when, items: usedUp, at: Date.now(), planStart: planStart ?? undefined });
  }, [active, pantry.isSuccess, saved.isLoading, meals.loading, later.loading]);
}
