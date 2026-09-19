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

// Confirmed working directly (not the older /fdc-app.html hash-routed URL,
// which redirects to a dead route).
export function getUsdaSourceUrl(fdcId: string | number) {
  return `https://fdc.nal.usda.gov/food-details/${fdcId}/nutrients`;
}

export type UsdaGroundingMatch = {
  fdcId: number;
  description: string;
  dataType: string;
  score: number;
  calories: number | null;
  protein: number | null;
  carbohydrates: number | null;
  fat: number | null;
  sugar: number | null;
  fiber: number | null;
  sodium: number | null;
};

export type UsdaGroundingResult =
  | { id: string; confidence: "NONE" }
  | { id: string; confidence: "ERROR"; error: string }
  | { id: string; confidence: "HIGH" | "LOW"; candidates: UsdaGroundingMatch[] };

export async function groundIngredientsUsda(
  ingredients: { id: string; canonicalName: string }[],
) {
  const { data, error } = await supabase.functions.invoke<{ results: UsdaGroundingResult[] }>(
    "ground-ingredients-usda",
    { body: { ingredients } },
  );
  if (error) throw error;
  return data?.results ?? [];
}

export function applyUsdaMatch(matched: UsdaGroundingMatch, confidence: "HIGH" | "LOW"): Partial<IngredientRow> {
  return {
    calories: matched.calories,
    protein: matched.protein,
    carbohydrates: matched.carbohydrates,
    fat: matched.fat,
    sugar: matched.sugar,
    fiber: matched.fiber,
    sodium: matched.sodium,
    source: "USDA",
    source_ref_id: matched.fdcId.toString(),
    source_description: matched.description,
    match_type: confidence === "HIGH" ? "exact" : "approximate",
    verification_status: confidence === "HIGH" ? "HIGH_CONFIDENCE" : "NEEDS_REVIEW",
    last_verified_at: new Date().toISOString(),
  };
}
