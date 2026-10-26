import { supabase } from "@/lib/supabase";
import type { Database, Json } from "@/lib/database.types";

// The signed-in user's saved meals (public.saved_meals, owner-only RLS).
// Rows only: the snapshot is built and read as a MealType in
// frontend/core/saved/savedMeals.ts.
export type SavedMealRow = Database["public"]["Tables"]["saved_meals"]["Row"];
export type MealStatusRow = Pick<Database["public"]["Tables"]["meals"]["Row"], "id" | "status" | "updated_at" | "archived_at">;

async function currentUserId() {
  const { data } = await supabase.auth.getSession();
  const id = data.session?.user.id;
  if (!id) throw new Error("Not signed in");
  return id;
}

// Most recent first.
export async function listSavedMealRows(): Promise<SavedMealRow[]> {
  const { data, error } = await supabase.from("saved_meals").select("*").order("saved_at", { ascending: false });
  if (error) throw error;
  return data;
}

export async function getSavedMealRow(id: string): Promise<SavedMealRow> {
  const { data, error } = await supabase.from("saved_meals").select("*").eq("id", id).single();
  if (error) throw error;
  return data;
}

// Throws Error("limit") at the 15-save cap (the table's trigger). Saving a
// meal that's already saved returns the existing row.
export async function insertSavedMeal(input: { mealId: string | null; mealKey: string; mealData: Json; servingSize: number }): Promise<SavedMealRow> {
  const userId = await currentUserId();
  const insert = (mealId: string | null) =>
    supabase
      .from("saved_meals")
      .insert({ user_id: userId, meal_id: mealId, meal_key: input.mealKey, meal_data: input.mealData, serving_size: input.servingSize })
      .select()
      .single();

  let { data, error } = await insert(input.mealId);
  // Not a catalog meal after all (no such meals row): save it unlinked.
  if (error?.code === "23503" && input.mealId) ({ data, error } = await insert(null));
  if (error?.code === "23505") {
    const existing = await supabase.from("saved_meals").select("*").eq("meal_key", input.mealKey).single();
    if (existing.error) throw existing.error;
    return existing.data;
  }
  if (error?.code === "P0001") throw new Error("limit");
  if (error) throw error;
  return data!;
}

export async function deleteSavedMeal(id: string): Promise<void> {
  const { error } = await supabase.from("saved_meals").delete().eq("id", id);
  if (error) throw error;
}

export async function updateSavedMeal(
  id: string,
  patch: { meal_data: Json; serving_size?: number; synced_at?: string },
): Promise<SavedMealRow> {
  const { data, error } = await supabase.from("saved_meals").update(patch).eq("id", id).select().single();
  if (error) throw error;
  return data;
}

// The live catalog meals behind some saves, for their "updated / pending /
// removed" status. A meal the user can't see is simply missing.
export async function getMealStatuses(ids: string[]): Promise<MealStatusRow[]> {
  if (ids.length === 0) return [];
  const { data, error } = await supabase.from("meals").select("id, status, updated_at, archived_at").in("id", ids);
  if (error) throw error;
  return data;
}
