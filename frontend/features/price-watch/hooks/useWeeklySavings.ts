import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { getMealPlan } from "@/api/mealPlans";
import { getMealsWithIngredients } from "@/api/meals";
import { mealIngredientLinePrice } from "@/frontend/core/meals/utils/mealAdapter";
import { ingredientChanges } from "@/frontend/core/prices/hooks/usePriceMeals";
import { usePriceItems } from "@/frontend/core/prices/hooks/usePriceItems";
import { addDays, toIsoDate } from "@/frontend/core/prices/utils/prices";
import { useSavedMeals } from "@/frontend/core/saved/hooks/useSavedMeals";
import { useIsPro } from "@/frontend/core/pro/store/useProStore";
import { useAuth } from "@/frontend/features/auth/hooks/useAuth";
import { planKey } from "@/frontend/features/meal-planner/hooks/useSavedMealPlan";
import { PLAN_DAYS } from "@/frontend/features/meal-planner/utils/generatePlan";

export type WeeklySavings = {
  /** ₱ less than at last week's prices; negative when prices went up. */
  total: number;
  /** What it was worked out on: the running meal plan, else saved meals. */
  source: "plan" | "saved";
  /** The meals that moved most, biggest saving first (up to 3). */
  top: { name: string; saving: number }[];
};

// Only catalog meals can be priced (a non-uuid id would fail the lookup).
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Servings cooked of each meal, by meal id.
type Cooked = Map<string, number>;

// Pro's weekly savings, in pesos: what the user's own meals cost this week
// against last week's DA prices (the same net change as "This week's best
// value meals": drops minus increases, on each meal's DA-linked
// ingredients). Worked out on the running meal plan (every slot, for its
// people), or, without one, on the saved meals at their saved servings.
// null when there's nothing to work it out on or no price changed.
export function useWeeklySavings() {
  const isPro = useIsPro();
  const userId = useAuth().session?.user.id ?? null;
  const enabled = isPro && !!userId;

  const items = usePriceItems();
  const plan = useQuery({ queryKey: planKey(userId), queryFn: getMealPlan, enabled });
  const saved = useSavedMeals();

  // Servings of each meal: the plan's while it's running, else saved meals'.
  const { cooked, source } = useMemo((): { cooked: Cooked; source: WeeklySavings["source"] } => {
    const today = toIsoDate(new Date());
    const row = plan.data;
    if (row && addDays(row.start_date, PLAN_DAYS - 1) >= today && Array.isArray(row.days)) {
      const counts: Cooked = new Map();
      for (const day of row.days) {
        if (!day || typeof day !== "object" || Array.isArray(day)) continue;
        for (const id of Object.values(day)) {
          if (typeof id === "string" && UUID.test(id)) counts.set(id, (counts.get(id) ?? 0) + row.servings);
        }
      }
      if (counts.size > 0) return { cooked: counts, source: "plan" };
    }
    const counts: Cooked = new Map();
    for (const meal of saved.data ?? []) {
      if (meal.id && UUID.test(meal.id) && meal.catalog_status !== "deleted") counts.set(meal.id, (counts.get(meal.id) ?? 0) + meal.serving_size);
    }
    return { cooked: counts, source: "saved" };
  }, [plan.data, saved.data]);

  const ids = useMemo(() => [...cooked.keys()].sort(), [cooked]);
  const meals = useQuery({
    queryKey: ["meals", "with-ingredients", ids],
    queryFn: () => getMealsWithIngredients(ids),
    enabled: enabled && ids.length > 0,
    staleTime: 10 * 60 * 1000,
  });

  const savings = useMemo((): WeeklySavings | null => {
    if (!meals.data || !items.data) return null;
    const changes = ingredientChanges(items.data);
    let any = false;
    const perMeal = meals.data.map((meal) => {
      let batch = 0;
      for (const mi of meal.meal_ingredients) {
        const pct = changes.get(mi.ingredient_id);
        const line = pct == null ? null : mealIngredientLinePrice(mi);
        if (pct == null || line == null) continue;
        any = true;
        // The line's price now is after the change; last week's was now / (1 + pct).
        batch += line / (1 + pct / 100) - line;
      }
      const servings = cooked.get(meal.id) ?? 0;
      return { name: meal.name, saving: batch * (servings / (meal.serving_size || 1)) };
    });
    if (!any) return null;
    return {
      total: perMeal.reduce((sum, m) => sum + m.saving, 0),
      source,
      top: perMeal
        .filter((m) => m.saving >= 1)
        .sort((a, b) => b.saving - a.saving)
        .slice(0, 3),
    };
  }, [meals.data, items.data, cooked, source]);

  return {
    enabled,
    savings,
    /** Nothing to work it out on: no running plan and no saved meals. */
    empty: enabled && !plan.isLoading && !saved.isLoading && ids.length === 0,
    loading: enabled && (items.isLoading || plan.isLoading || (ids.length > 0 && meals.isLoading)),
  };
}
