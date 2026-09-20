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

// Used by the meal seeder's "Add + use" USDA fallback — when an admin
// building a meal can't find a matching row in `ingredients` at all, this
// creates one from a chosen USDA candidate (via applyUsdaMatch's patch
// shape) so meal_ingredients always has a real row to reference, never an
// ad-hoc unlinked guess. `canonical_name` is the only required field the
// caller must supply on top of applyUsdaMatch's output; everything else
// (category/food_group/role/state/price) is left for the admin to fill in
// via the normal edit sheet afterward, same as any freshly-seeded batch row.
export async function createIngredient(patch: Partial<IngredientRow> & { canonical_name: string }) {
  const { data, error } = await supabase.from("ingredients").insert(patch).select().single();
  if (error) throw error;
  return data;
}

// Marks ingredients as having gone through a USDA grounding attempt,
// regardless of outcome (matched, no confident match, error, or a match
// found but never applied). Call this after every batch grounding run so
// the "still manual" candidate pool doesn't keep resurfacing ingredients
// that were already checked — see migration
// 20260919000000_ingredients_track_usda_grounding_attempts.sql.
export async function markUsdaGroundingAttempted(ids: string[]) {
  if (ids.length === 0) return;
  const { error } = await supabase
    .from("ingredients")
    .update({ usda_last_attempted_at: new Date().toISOString() })
    .in("id", ids);
  if (error) throw error;
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

// Mirrors ground-ingredients-usda's own HIGH_SCORE_THRESHOLD (300) so a
// per-candidate label in the UI means the same thing here as it does in
// the USDA grounding panel/edit sheet, rather than showing a raw score the
// admin has no reference scale for.
const USDA_HIGH_SCORE_THRESHOLD = 300;
export function classifyUsdaConfidence(score: number): "HIGH" | "LOW" {
  return score >= USDA_HIGH_SCORE_THRESHOLD ? "HIGH" : "LOW";
}

export type AiIngredientEstimate = Partial<IngredientRow> & { canonical_name: string };

// AI-curated fallback for the meal seeder — when a recipe ingredient has no
// ingredients-table match AND no confident USDA candidate. Returns a DRAFT
// only; never writes to the database. The caller (SeedMealIngredientsEditor)
// opens this in IngredientEditSheet for review/edit, then a confirmation
// step before actually calling createIngredient.
export async function estimateIngredientAi(name: string): Promise<AiIngredientEstimate> {
  const { data, error } = await supabase.functions.invoke<{ ingredient: AiIngredientEstimate }>(
    "estimate-ingredient-ai",
    { body: { name } },
  );
  if (error) throw error;
  if (!data?.ingredient) throw new Error("AI estimate returned no data");
  return {
    ...data.ingredient,
    source: "manual",
    source_description: data.ingredient.source_description ?? "AI-estimated via OpenAI, pending FNRI/USDA grounding",
    verification_status: "NEEDS_REVIEW",
    price_source: "manual",
  };
}

// Fills in the operational fields USDA never provides (role, category,
// price, the piece-count bridge) for an ingredient that was just created
// from a real USDA match. Without this, a recipe quantifying that
// ingredient by piece silently contributes nothing to a meal's totals —
// convertQuantityToBasis has no grams_per_piece to work with — and price
// stays permanently null. Never touches the nutrition/source fields
// already set from the real USDA match; only asks the LLM for what's
// actually missing, echoing the known macros back unchanged as context.
export async function estimateIngredientGaps(ingredient: IngredientRow): Promise<Partial<IngredientRow>> {
  const { data, error } = await supabase.functions.invoke<{ ingredient: AiIngredientEstimate }>(
    "estimate-ingredient-ai",
    {
      body: {
        name: ingredient.canonical_name,
        known: {
          basis_amount: ingredient.basis_amount,
          basis_unit: ingredient.basis_unit,
          calories: ingredient.calories,
          protein: ingredient.protein,
          carbohydrates: ingredient.carbohydrates,
          fat: ingredient.fat,
          sugar: ingredient.sugar,
          fiber: ingredient.fiber,
          sodium: ingredient.sodium,
        },
      },
    },
  );
  if (error) throw error;
  const est = data?.ingredient;
  if (!est) throw new Error("AI gap-fill returned no data");

  return {
    display_name: ingredient.display_name ?? est.display_name ?? null,
    aliases: ingredient.aliases && ingredient.aliases.length > 0 ? ingredient.aliases : est.aliases ?? [],
    category: ingredient.category ?? est.category ?? null,
    food_group: ingredient.food_group ?? est.food_group ?? null,
    role: ingredient.role ?? est.role ?? null,
    state: ingredient.state ?? est.state ?? null,
    estimated_price: ingredient.estimated_price ?? est.estimated_price ?? null,
    estimated_price_unit: ingredient.estimated_price_unit ?? est.estimated_price_unit ?? null,
    grams_per_ml: ingredient.grams_per_ml ?? est.grams_per_ml ?? null,
    grams_per_piece: ingredient.grams_per_piece ?? est.grams_per_piece ?? null,
    piece_label: ingredient.piece_label ?? est.piece_label ?? null,
  };
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
