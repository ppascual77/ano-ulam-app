import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { getMealPlan, saveMealPlan, type MealPlanRow } from "@/api/mealPlans";
import type { Json } from "@/lib/database.types";
import { useRealMeals } from "@/frontend/core/meals/hooks/useRealMeals";
import { mealTimesOf } from "@/frontend/core/meals/utils/mealTimes";
import { scaleMeal } from "@/frontend/core/meals/utils/scaleMeal";
import { useAuth } from "@/frontend/features/auth/hooks/useAuth";
import { usePlannerStore } from "../store/usePlannerStore";
import { SLOTS, planDates, type MealPlan, type MealSlot, type PlannerMeal } from "../utils/generatePlan";
import type { Goal, MacroTargets } from "../utils/macros";

const planKey = (userId: string | null) => ["meal-plan", userId] as const;

// "2026-11-01" in the phone's own time zone (a plan's days are local days).
const localDate = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
const fromLocalDate = (value: string) => {
  const [y, m, d] = value.split("-").map(Number);
  return new Date(y, m - 1, d);
};

const GOALS: Goal[] = ["lose", "build", "maintain"];

function parseTargets(value: Json | null): MacroTargets | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const { calories, protein, carbs, fats } = value as Record<string, unknown>;
  return [calories, protein, carbs, fats].every((n) => typeof n === "number")
    ? { calories: calories as number, protein: protein as number, carbs: carbs as number, fats: fats as number }
    : null;
}

// The plan back from its saved meal ids, against the catalog as it is now.
// null when it has ended (its last day is before today) or one of its meals
// is no longer in the catalog: the planner then starts from setup, with
// the saved budget, people and goal filled in.
function rebuildPlan(row: MealPlanRow, byId: Map<string, PlannerMeal>, targets: MacroTargets | null): MealPlan | null {
  const dates = planDates(fromLocalDate(row.start_date));
  if (localDate(dates[dates.length - 1]) < localDate(new Date())) return null;
  if (!Array.isArray(row.days) || row.days.length !== dates.length) return null;
  const days: MealPlan["days"] = [];
  for (const [i, entry] of row.days.entries()) {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) return null;
    const ids = entry as Record<string, unknown>;
    const meals = SLOTS.map((slot) => ({ slot, meal: typeof ids[slot] === "string" ? byId.get(ids[slot] as string) : undefined }));
    if (meals.some((m) => !m.meal)) return null;
    days.push({ date: dates[i], meals: meals as { slot: MealSlot; meal: PlannerMeal }[] });
  }
  return { days, budget: Number(row.budget), servings: row.servings, targets };
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

  useEffect(() => {
    if (!userId || loadedFor === userId) return;
    // Couldn't load: start from setup rather than wait forever.
    if (saved.isError || catalogFailed) return loadSaved(userId, null);
    if (saved.data === undefined || !catalog) return;
    const row = saved.data;
    if (!row) return loadSaved(userId, null);
    // Every catalog meal (not just what preferences allow now), one serving,
    // so a plan made before a preference change still opens.
    const byId = new Map(
      catalog.flatMap((meal) => (meal.id ? [[meal.id, { ...scaleMeal(meal, 1), slots: mealTimesOf(meal.tags) }] as const] : [])),
    );
    const targets = parseTargets(row.targets);
    loadSaved(userId, {
      budget: String(Number(row.budget)),
      servings: row.servings,
      targets,
      goal: GOALS.includes(row.goal as Goal) ? (row.goal as Goal) : null,
      plan: rebuildPlan(row, byId, targets),
    });
  }, [userId, loadedFor, saved.data, saved.isError, catalog, catalogFailed, loadSaved]);

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
      });
      queryClient.setQueryData(planKey(userId), row);
      return true;
    } catch {
      return false;
    }
  };

  return { save, loading: !!userId && loadedFor !== userId };
}
