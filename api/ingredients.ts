import { supabase, invokeEdgeFunction } from "@/lib/supabase";
import type { Database } from "@/lib/database.types";

export type IngredientRow = Database["public"]["Tables"]["ingredients"]["Row"];

export type BridgeField = "grams_per_piece" | "piece_label" | "grams_per_ml";

// Whether the admin verified this bridge (see the bridge locks migration).
// A verified bridge is a fact: checks may question a recipe's quantity
// against it, never the bridge itself. The DB rejects edits to it that
// don't re-stamp the lock.
export function isBridgeLocked(ingredient: IngredientRow, field: BridgeField): boolean {
  return field === "grams_per_ml" ? ingredient.density_verified_at != null : ingredient.piece_verified_at != null;
}

// Macros the admin verified: locked like bridges (see the armour migration),
// and skipped by batch USDA/FNRI grounding.
export function isMacrosVerified(ingredient: IngredientRow): boolean {
  return ingredient.macros_verified_at != null;
}

// The price's sources and unit were checked. Not a lock: the amount still
// follows its sources (DA refreshes), checks just don't question the source.
export function isPriceVerified(ingredient: IngredientRow): boolean {
  return ingredient.price_verified_at != null;
}

export type IngredientFilters = {
  role?: string;
  foodGroup?: string;
  source?: string;
  priceSource?: string;
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
  if (filters.priceSource) {
    query = query.eq("price_source", filters.priceSource);
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

// Sent USDA_BATCH_SIZE at a time, one call after another, rather than the
// whole list in one call: ~4 USDA requests per ingredient meant a run over
// a couple hundred ingredients hit USDA's hourly key limit and came back
// as ERROR. Smaller calls also stay well inside the edge function's time
// limit.
const USDA_BATCH_SIZE = 10;

export async function groundIngredientsUsda(
  ingredients: { id: string; canonicalName: string }[],
) {
  const results: UsdaGroundingResult[] = [];
  for (let i = 0; i < ingredients.length; i += USDA_BATCH_SIZE) {
    const data = await invokeEdgeFunction<{ results: UsdaGroundingResult[] }>("ground-ingredients-usda", {
      ingredients: ingredients.slice(i, i + USDA_BATCH_SIZE),
    });
    results.push(...(data.results ?? []));
  }
  return results;
}

// Mirrors ground-ingredients-usda's own HIGH_SCORE_THRESHOLD (300) so a
// per-candidate label in the UI means the same thing here as it does in
// the USDA grounding panel/edit sheet, rather than showing a raw score the
// admin has no reference scale for.
const USDA_HIGH_SCORE_THRESHOLD = 300;
export function classifyUsdaConfidence(score: number): "HIGH" | "LOW" {
  return score >= USDA_HIGH_SCORE_THRESHOLD ? "HIGH" : "LOW";
}

// Same idea as markUsdaGroundingAttempted, for the supermarket price pass —
// see migration 20261003000000_ingredients_price_grounding.sql.
export async function markPriceGroundingAttempted(ids: string[]) {
  if (ids.length === 0) return;
  const { error } = await supabase
    .from("ingredients")
    .update({ price_last_attempted_at: new Date().toISOString() })
    .in("id", ids);
  if (error) throw error;
}

export type PriceGroundingCandidate = {
  confidence: "HIGH" | "LOW";
  reasons: string[];
  pricePerUnit: number;
  unit: "kg" | "L";
  store: string;
  productTitle: string;
  packPrice: number;
  packSize: number;
  packUnit: "g" | "kg" | "ml" | "L" | "piece";
  url: string;
};

// Actual OpenAI spend for one lookup, as reported by ground-ingredient-prices.
export type PriceGroundingUsage = { searchCalls: number; inputTokens: number; outputTokens: number; costUsd: number };

export type PriceGroundingResult = (
  | { id: string; confidence: "NONE"; reason: string }
  | { id: string; confidence: "ERROR"; error: string }
  // Up to 3 candidates, one per store, best first. `confidence` is the
  // best candidate's.
  | { id: string; confidence: "HIGH" | "LOW"; candidates: PriceGroundingCandidate[] }
) & { usage?: PriceGroundingUsage };

// Mirrors ground-ingredient-prices's own MAX_PER_CALL — callers chunk to this.
export const PRICE_GROUNDING_MAX_PER_CALL = 5;

export async function groundIngredientPrices(ingredients: IngredientRow[]) {
  const data = await invokeEdgeFunction<{ results: PriceGroundingResult[] }>("ground-ingredient-prices", {
    ingredients: ingredients.map((i) => ({
      id: i.id,
      canonicalName: i.canonical_name,
      displayName: i.display_name,
      basisUnit: i.basis_unit,
      state: i.state,
      gramsPerMl: i.grams_per_ml,
      gramsPerPiece: i.grams_per_piece,
    })),
  });
  return data.results ?? [];
}

// One place an ingredient can be bought, in ₱ per kg or L: a supermarket
// listing (price_sources) or the linked DA commodity's latest price.
export type PriceOption = { source: "supermarket" | "da"; pricePerUnit: number; unit: "kg" | "L" };

// price_sources is jsonb, so its shape isn't enforced by the DB. A pack
// estimate (see PackEstimateSource) isn't a store price, so it's skipped:
// it never sets estimated_price or gets "Best price".
export function supermarketPriceOptions(priceSources: unknown): PriceOption[] {
  if (!Array.isArray(priceSources)) return [];
  return priceSources.flatMap((s) =>
    s && !isPackEstimate(s) && typeof s.pricePerUnit === "number" && (s.unit === "kg" || s.unit === "L")
      ? [{ source: "supermarket" as const, pricePerUnit: s.pricePerUnit, unit: s.unit }]
      : [],
  );
}

// The cheapest option sets estimated_price (and gets the "Best price"
// badge on ingredient detail). Only options in one unit are compared: the
// first DA one's when there is one, since DA is the reference price.
export function cheapestPriceOption(options: PriceOption[]): PriceOption | null {
  if (options.length === 0) return null;
  const unit = (options.find((o) => o.source === "da") ?? options[0]).unit;
  return options.filter((o) => o.unit === unit).reduce((best, o) => (o.pricePerUnit < best.pricePerUnit ? o : best));
}

// The price fields for the cheapest option, or null when there's no option
// or the ingredient already has exactly that price.
export function cheapestPricePatch(
  ingredient: Pick<IngredientRow, "estimated_price" | "estimated_price_unit" | "price_source">,
  options: PriceOption[],
): Partial<IngredientRow> | null {
  const best = cheapestPriceOption(options);
  if (!best) return null;
  const price = Math.round(best.pricePerUnit * 100) / 100;
  if (
    ingredient.estimated_price === price &&
    ingredient.estimated_price_unit === best.unit &&
    ingredient.price_source === best.source
  ) {
    return null;
  }
  return {
    estimated_price: price,
    estimated_price_unit: best.unit,
    price_source: best.source,
    price_last_updated_at: new Date().toISOString(),
  };
}

// Replaces the supermarket listings with the admin-selected ones (each kept
// with its link in price_sources, see migration
// 20261003010000_ingredients_price_sources.sql) and re-picks the cheapest
// price. `daOptions` are the linked DA commodities' prices, so a cheaper DA
// price stays the ingredient's price. A pack estimate is dropped too: real
// listings replace it.
export function applyPriceMatch(
  ingredient: IngredientRow,
  candidates: PriceGroundingCandidate[],
  daOptions: PriceOption[],
): Partial<IngredientRow> {
  if (candidates.length === 0) throw new Error("applyPriceMatch needs at least one source");
  const priceSources = candidates.map(({ store, productTitle, packPrice, packSize, packUnit, url, pricePerUnit, unit }) => ({
    store,
    productTitle,
    packPrice,
    packSize,
    packUnit,
    url,
    pricePerUnit,
    unit,
  }));
  const options = [...supermarketPriceOptions(priceSources), ...daOptions];
  return {
    price_sources: priceSources,
    ...cheapestPricePatch(ingredient, options),
    price_last_updated_at: new Date().toISOString(),
  };
}

// ---------------------------------------------------------------------------
// Pack estimates: the typical retail pack of a packaged item with no store
// listing ("385 ml bottle"), so the grocery list can show whole packs for
// it. Stored as one more price_sources entry, same shape as a listing plus
// `estimate: true`. The AI only picks the pack size; its price is this
// ingredient's own per-kg/L price x that size, so the estimate never moves
// the ingredient's price, price_source, or any real listing.

export type PackEstimateSource = {
  estimate: true;
  estimatedBy: "ai";
  estimatedAt: string;
  store: null;
  url: null;
  /** "385 ml bottle" */
  productTitle: string;
  packSize: number;
  packUnit: "g" | "ml";
  /** "bottle", "pack", "jar"… */
  container: string;
  /** A common product at that size, for the admin's review only. */
  example: string | null;
  /** Snapshot at estimate time. Readers re-derive the price from the
   *  ingredient's current price, see packEstimatePrice. */
  packPrice: number;
  pricePerUnit: number;
  unit: "kg" | "L";
};

export function isPackEstimate(source: unknown): source is PackEstimateSource {
  return !!source && typeof source === "object" && (source as { estimate?: unknown }).estimate === true;
}

export function packEstimateOf(priceSources: unknown): PackEstimateSource | null {
  if (!Array.isArray(priceSources)) return null;
  const found = priceSources.find(isPackEstimate);
  return found && typeof found.packSize === "number" && found.packSize > 0 ? found : null;
}

type PricedIngredient = Pick<IngredientRow, "estimated_price" | "estimated_price_unit" | "grams_per_ml">;

// The ingredient's own price in ₱ per kg or L, or null when it has none.
export function ingredientPricePerUnit(ingredient: PricedIngredient): { pricePerUnit: number; unit: "kg" | "L" } | null {
  const price = ingredient.estimated_price;
  if (price == null || price <= 0) return null;
  switch (ingredient.estimated_price_unit) {
    case "g":
      return { pricePerUnit: price * 1000, unit: "kg" };
    case "kg":
      return { pricePerUnit: price, unit: "kg" };
    case "ml":
      return { pricePerUnit: price * 1000, unit: "L" };
    case "L":
      return { pricePerUnit: price, unit: "L" };
    default:
      return null;
  }
}

// A pack's size in kg or L. Weight to volume (a 470 ml jar of mayonnaise
// priced per kg) goes through grams_per_ml, or water's density without one.
export function packSizeInUnit(
  packSize: number,
  packUnit: "g" | "ml",
  unit: "kg" | "L",
  gramsPerMl: number | null,
): number {
  const density = gramsPerMl && gramsPerMl > 0 ? gramsPerMl : 1;
  if (packUnit === "g") return unit === "kg" ? packSize / 1000 : packSize / density / 1000;
  return unit === "L" ? packSize / 1000 : (packSize * density) / 1000;
}

// The estimate's pack price from the ingredient's current price, so it
// follows any later correction to that price.
export function packEstimatePrice(estimate: PackEstimateSource, ingredient: PricedIngredient): number | null {
  const own = ingredientPricePerUnit(ingredient);
  if (!own) return null;
  return packSizeInUnit(estimate.packSize, estimate.packUnit, own.unit, ingredient.grams_per_ml) * own.pricePerUnit;
}

// What the estimate-pack-sizes edge function returns per ingredient.
export type AiPackSize =
  | { id: string; packSize: number; packUnit: "g" | "ml"; container: string; example: string | null }
  | { id: string; error: string };

// Mirrors estimate-pack-sizes's own MAX_PER_CALL.
export const PACK_ESTIMATE_MAX_PER_CALL = 25;

export async function estimatePackSizes(ingredients: IngredientRow[]): Promise<AiPackSize[]> {
  const data = await invokeEdgeFunction<{ results: AiPackSize[] }>("estimate-pack-sizes", {
    ingredients: ingredients.map((i) => ({
      id: i.id,
      name: i.canonical_name,
      category: i.category,
      priceUnit: ingredientPricePerUnit(i)?.unit ?? null,
    })),
  });
  return data.results ?? [];
}

export function buildPackEstimate(
  ingredient: IngredientRow,
  pack: { packSize: number; packUnit: "g" | "ml"; container: string; example: string | null },
): PackEstimateSource | null {
  const own = ingredientPricePerUnit(ingredient);
  if (!own) return null;
  const size = packSizeInUnit(pack.packSize, pack.packUnit, own.unit, ingredient.grams_per_ml);
  return {
    estimate: true,
    estimatedBy: "ai",
    estimatedAt: new Date().toISOString(),
    store: null,
    url: null,
    productTitle: `${pack.packSize} ${pack.packUnit} ${pack.container}`,
    packSize: pack.packSize,
    packUnit: pack.packUnit,
    container: pack.container,
    example: pack.example,
    packPrice: Math.round(size * own.pricePerUnit * 100) / 100,
    pricePerUnit: own.pricePerUnit,
    unit: own.unit,
  };
}

// Upserts the estimate: replaces an earlier one, keeps every other entry
// (real listings) exactly as it was. Only price_sources is written.
export function applyPackEstimate(ingredient: IngredientRow, estimate: PackEstimateSource): Partial<IngredientRow> {
  const others = Array.isArray(ingredient.price_sources)
    ? ingredient.price_sources.filter((s) => !isPackEstimate(s))
    : [];
  return { price_sources: [...others, estimate] };
}

export type AiIngredientEstimate = Partial<IngredientRow> & { canonical_name: string };

// AI-curated fallback for the meal seeder — when a recipe ingredient has no
// ingredients-table match AND no confident USDA candidate. Returns a DRAFT
// only; never writes to the database. The caller (SeedMealIngredientsEditor)
// opens this in IngredientEditSheet for review/edit, then a confirmation
// step before actually calling createIngredient.
export async function estimateIngredientAi(name: string): Promise<AiIngredientEstimate> {
  const data = await invokeEdgeFunction<{ ingredient: AiIngredientEstimate }>("estimate-ingredient-ai", { name });
  if (!data.ingredient) throw new Error("AI estimate returned no data");
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
export async function estimateIngredientGaps(
  ingredient: IngredientRow,
  // When set, this specific bridge is required for a quantity the admin is
  // ACTIVELY trying to use right now (a real conversion just failed on
  // it) — without this, the LLM's own general judgment about whether e.g.
  // grams_per_ml is "needed" for this ingredient (reasonable in the
  // abstract — pineapple isn't a liquid) can override what's actually
  // needed for the recipe in front of the admin, which measures it by cup.
  requiredBridge?: "grams_per_ml" | "grams_per_piece",
): Promise<Partial<IngredientRow>> {
  const data = await invokeEdgeFunction<{ ingredient: AiIngredientEstimate }>("estimate-ingredient-ai", {
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
    requiredBridge,
  });
  const est = data.ingredient;
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

// One hand-curated PhilFCT (DOST-FNRI) row, per 100 g edible portion.
export type FnriMatch = {
  fnriName: string | null;
  calories: number;
  protein: number | null;
  carbohydrates: number | null;
  fat: number | null;
  fiber: number | null;
  sugar: number | null;
  sodium: number | null;
};

// FNRI grounding (Manage Ingredients > FNRI). Replaces every nutrition field,
// null where PhilFCT doesn't report a nutrient, so no leftover value from
// another source gets mixed in (docs/ingredient-data-architecture.md: never
// merge FNRI and USDA). VERIFIED: every row was matched to its ingredient by
// hand. FNRI has no public food IDs, so source_ref_id is cleared and the
// PhilFCT food name is the citation.
export function applyFnriMatch(food: FnriMatch): Partial<IngredientRow> {
  return {
    calories: food.calories,
    protein: food.protein,
    carbohydrates: food.carbohydrates,
    fat: food.fat,
    sugar: food.sugar,
    fiber: food.fiber,
    sodium: food.sodium,
    source: "FNRI",
    source_ref_id: null,
    source_description: food.fnriName,
    match_type: "exact",
    verification_status: "VERIFIED",
    last_verified_at: new Date().toISOString(),
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
