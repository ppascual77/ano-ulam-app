import { useEffect, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { getMealPlan, saveMealPlan, type MealPlanRow } from "@/api/mealPlans";
import type { Json } from "@/lib/database.types";
import { useRealMeals } from "@/frontend/core/meals/hooks/useRealMeals";
import { mealTimesOf } from "@/frontend/core/meals/utils/mealTimes";
import { scaleMeal } from "@/frontend/core/meals/utils/scaleMeal";
import { useAuth } from "@/frontend/features/auth/hooks/useAuth";
import { usePlannerStore } from "../store/usePlannerStore";
import { DEFAULT_RICE_CUPS, PLAN_LENGTHS, RICE_CUP_OPTIONS, SLOTS, planDates, type MealPlan, type MealSlot, type PlanRice, type PlannerMeal, type RiceCups } from "../utils/generatePlan";
import { usePlannerRice } from "./usePlannerRice";
import type { Goal, MacroTargets } from "@/frontend/core/nutrition/macros";

export const planKey = (userId: string | null) => ["meal-plan", userId] as const;

// "2026-11-01" in the phone's own time zone (a plan's days are local days).
const localDate = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
const fromLocalDate = (value: string) => {
  const [y, m, d] = value.split("-").map(Number);
  return new Date(y, m - 1, d);
};

const GOALS: Goal[] = ["lose", "build", "maintain"];

// A saved plan's rice: null on plans from before rice was counted (they
// reopen without it, keeping the numbers they were built with).
const savedRiceCups = (value: number | null | undefined): RiceCups | null =>
  (RICE_CUP_OPTIONS as number[]).includes(value as number) ? (value as RiceCups) : null;

function parseTargets(value: Json | null): MacroTargets | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const { calories, protein, carbs, fats } = value as Record<string, unknown>;
  return [calories, protein, carbs, fats].every((n) => typeof n === "number")
    ? { calories: calories as number, protein: protein as number, carbs: carbs as number, fats: fats as number }
    : null;
}

// Whether today falls inside a plan running from `first` to `last`. A plan
// that has ended, or one that hasn't started yet (only possible when the
// phone's clock moved: plans always start the day they're made), isn't
// the plan you're on.
const coversToday = (first: Date, last: Date) => {
  const today = localDate(new Date());
  return localDate(first) <= today && localDate(last) >= today;
};

// The plan back from its saved meal ids, against the catalog as it is now.
// null when it doesn't cover today (see coversToday) or one of its meals is
// no longer in the catalog: the planner then starts from setup, with the
// saved budget, people and goal filled in. With `startFrom`, the same meals
// laid out again from that day (Use it again), whatever its old dates.
function rebuildPlan(
  row: MealPlanRow,
  byId: Map<string, PlannerMeal>,
  targets: MacroTargets | null,
  rice: PlanRice | null,
  startFrom?: Date,
): MealPlan | null {
  // 5 or 7 days, as it was built.
  if (!Array.isArray(row.days) || !(PLAN_LENGTHS as readonly number[]).includes(row.days.length)) return null;
  const dates = planDates(startFrom ?? fromLocalDate(row.start_date), row.days.length);
  if (!startFrom && !coversToday(dates[0], dates[dates.length - 1])) return null;
  if (!Array.isArray(row.days) || row.days.length !== dates.length) return null;
  const days: MealPlan["days"] = [];
  for (const [i, entry] of row.days.entries()) {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) return null;
    const ids = entry as Record<string, unknown>;
    const meals = SLOTS.map((slot) => ({ slot, meal: typeof ids[slot] === "string" ? byId.get(ids[slot] as string) : undefined }));
    if (meals.some((m) => !m.meal)) return null;
    days.push({ date: dates[i], meals: meals as { slot: MealSlot; meal: PlannerMeal }[] });
  }
  return { days, budget: Number(row.budget), servings: row.servings, targets, rice };
}

// The signed-in user's plan, saved to the account (public.meal_plans):
// loads it into the planner store once per account (any screen showing the
// plan can call this: the Meal Planner, Profile's grocery list), and
// `save` writes the store's plan back after every change (a new plan, a
// regenerated day, a swap). Guests plan in memory only, as before.
export function useSavedMealPlan() {
  const { session } = useAuth();
  const userId = session?.user.id ?? null;
  const queryClient = useQueryClient();
  const saved = useQuery({ queryKey: planKey(userId), queryFn: getMealPlan, enabled: !!userId });
  const { data: catalog, isError: catalogFailed } = useRealMeals();
  const loadedFor = usePlannerStore((s) => s.loadedFor);
  const loadSaved = usePlannerStore((s) => s.loadSaved);
  const { cup: riceCup, ingredient: riceIngredient, ownCarbIds } = usePlannerRice();
  const riceOf = (row: MealPlanRow): PlanRice | null => {
    const cups = savedRiceCups(row.rice_cups);
    return cups ? { cups, cup: riceCup, ingredient: riceIngredient } : null;
  };
  // Every catalog meal (not just what preferences allow now), one serving,
  // so a plan made before a preference change still opens.
  const byId = useMemo(
    () =>
      catalog
        ? new Map(
            catalog.flatMap((meal) =>
              meal.id ? [[meal.id, { ...scaleMeal(meal, 1), slots: mealTimesOf(meal.tags), ownCarb: ownCarbIds.has(meal.id) }] as const] : [],
            ),
          )
        : null,
    [catalog, ownCarbIds],
  );

  useEffect(() => {
    if (!userId || loadedFor === userId) return;
    // Couldn't load: start from setup rather than wait forever.
    if (saved.isError || catalogFailed) return loadSaved(userId, null);
    if (saved.data === undefined || !catalog) return;
    const row = saved.data;
    if (!row) return loadSaved(userId, null);
    if (!byId) return;
    const targets = parseTargets(row.targets);
    loadSaved(userId, {
      budget: String(Number(row.budget)),
      servings: row.servings,
      targets,
      goal: GOALS.includes(row.goal as Goal) ? (row.goal as Goal) : null,
      // The next build starts from the plan's own choice (default for one
      // saved before rice was counted).
      riceCups: savedRiceCups(row.rice_cups) ?? DEFAULT_RICE_CUPS,
      plan: rebuildPlan(row, byId, targets, riceOf(row)),
    });
  }, [userId, loadedFor, saved.data, saved.isError, byId, catalogFailed, loadSaved]);

  // A plan that stopped covering today while the app stayed open (it ended
  // overnight, or the clock moved either way) drops back to setup, budget
  // and people kept, the same as one found that way when loading. Otherwise
  // Home says "Plan your week" while the planner still opens on the old plan.
  const plan = usePlannerStore((s) => s.plan);
  const stale = !!plan && plan.days.length > 0 && !coversToday(plan.days[0].date, plan.days[plan.days.length - 1].date);
  useEffect(() => {
    if (!stale) return;
    usePlannerStore.getState().setPlan(null);
    usePlannerStore.getState().setStage("setup");
  }, [stale]);

  // The last plan's meals laid out again from today, for the planner's
  // "Loved your last plan?" offer: only while there's no plan running and
  // every one of its meals is still in the catalog.
  const previous = useMemo(() => {
    const row = saved.data;
    if (plan || !row || !byId) return null;
    return rebuildPlan(row, byId, parseTargets(row.targets), riceOf(row), new Date());
  }, [plan, saved.data, byId]);

  // Resolves false when it couldn't be saved (the plan stays on screen).
  const save = async (plan: MealPlan, goal: Goal | null): Promise<boolean> => {
    if (!userId) return true;
    try {
      const row = await saveMealPlan({
        startDate: localDate(plan.days[0].date),
        budget: plan.budget,
        servings: plan.servings,
        targets: plan.targets,
        goal,
        days: plan.days.map((day) => Object.fromEntries(day.meals.map(({ slot, meal }) => [slot, meal.id ?? null]))),
        riceCups: plan.rice?.cups ?? 0,
      });
      queryClient.setQueryData(planKey(userId), row);
      return true;
    } catch {
      return false;
    }
  };

  return { save, previous, loading: !!userId && loadedFor !== userId };
}
