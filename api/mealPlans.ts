import { supabase } from "@/lib/supabase";
import type { Database, Json } from "@/lib/database.types";

// The signed-in user's current meal plan (public.meal_plans, owner-only,
// one per user). Rows only: the plan is rebuilt from the catalog in
// frontend/features/meal-planner/hooks/useSavedMealPlan.ts.
export type MealPlanRow = Database["public"]["Tables"]["meal_plans"]["Row"];

async function currentUserId() {
  const { data } = await supabase.auth.getSession();
  const id = data.session?.user.id;
  if (!id) throw new Error("Not signed in");
  return id;
}

/** null when the user hasn't built one. */
export async function getMealPlan(): Promise<MealPlanRow | null> {
  const { data, error } = await supabase.from("meal_plans").select("*").maybeSingle();
  if (error) throw error;
  return data;
}

/** Saves the plan, replacing the current one. */
export async function saveMealPlan(plan: {
  startDate: string;
  budget: number;
  servings: number;
  targets: Json | null;
  goal: string | null;
  days: Json;
}): Promise<MealPlanRow> {
  const userId = await currentUserId();
  const { data, error } = await supabase
    .from("meal_plans")
    .upsert({
      user_id: userId,
      start_date: plan.startDate,
      budget: plan.budget,
      servings: plan.servings,
      targets: plan.targets,
      goal: plan.goal,
      days: plan.days,
      updated_at: new Date().toISOString(),
    })
    .select()
    .single();
  if (error) throw error;
  return data;
}
