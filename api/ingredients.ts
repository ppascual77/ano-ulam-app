import { supabase } from "@/lib/supabase";
import type { Database } from "@/lib/database.types";

export type IngredientRow = Database["public"]["Tables"]["ingredients"]["Row"];

export type IngredientFilters = {
  role?: string;
  foodGroup?: string;
  source?: string;
  showArchived?: boolean;
  search?: string;
};

export async function getIngredients(filters: IngredientFilters = {}) {
  let query = supabase.from("ingredients").select("*").order("canonical_name");

  if (!filters.showArchived) {
    query = query.is("archived_at", null);
  }
  if (filters.role) {
    query = query.eq("role", filters.role);
  }
  if (filters.foodGroup) {
    query = query.eq("food_group", filters.foodGroup);
  }
  if (filters.source) {
    query = query.eq("source", filters.source);
  }
  if (filters.search) {
    query = query.ilike("canonical_name", `%${filters.search}%`);
  }

  const { data, error } = await query;
  if (error) throw error;
  return data;
}

export async function updateIngredient(id: string, patch: Partial<IngredientRow>) {
  const { data, error } = await supabase
    .from("ingredients")
    .update(patch)
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function archiveIngredient(id: string) {
  return updateIngredient(id, { archived_at: new Date().toISOString() });
}
