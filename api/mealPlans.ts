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
  /** Cups of rice per person with lunch and dinner (0-2). */
  riceCups: number;
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
      rice_cups: plan.riceCups,
      updated_at: new Date().toISOString(),
    })
    .select()
    .single();
  if (error) throw error;
  return data;
}

// ---- Rice in a plan ------------------------------------------------------------

/** The catalog's raw white rice, which the plan's cups of rice are priced and
 *  counted from (its price follows the daily DA import). null if missing. */
export async function getPlannerRice() {
  const { data, error } = await supabase
    .from("ingredients")
    .select("id, canonical_name, display_name, category, calories, protein, carbohydrates, fat, basis_amount, basis_unit, estimated_price, estimated_price_unit")
    .eq("canonical_name", "Rice, white, raw")
    .maybeSingle();
  if (error) throw error;
  return data;
}

/** Every catalog ingredient's id and name: the planner picks out the ones
 *  that are a dish's own rice or noodles. */
export async function getIngredientNames(): Promise<{ id: string; canonical_name: string }[]> {
  const { data, error } = await supabase.from("ingredients").select("id, canonical_name");
  if (error) throw error;
  return data ?? [];
}
