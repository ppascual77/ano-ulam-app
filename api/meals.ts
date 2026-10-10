import { supabase, invokeEdgeFunction } from "@/lib/supabase";
import type { Database } from "@/lib/database.types";
import type { IngredientRow } from "./ingredients";
import type { DaCommodityRow } from "./daPrices";

export type MealRow = Database["public"]["Tables"]["meals"]["Row"];
export type MealIngredientRow = Database["public"]["Tables"]["meal_ingredients"]["Row"];

// The DA commodities linked to an ingredient, one DA price source each.
// Only getMeal joins them; optional so ingredient rows built elsewhere fit.
export type LinkedDaCommodity = Pick<
  DaCommodityRow,
  "id" | "commodity" | "specification" | "unit" | "unit_size" | "latest_price" | "latest_price_date"
>;

export type MealWithIngredients = MealRow & {
  meal_ingredients: (MealIngredientRow & { ingredient: IngredientRow & { da_commodities?: LinkedDaCommodity[] } })[];
};

export type QuantityUnit = "g" | "kg" | "ml" | "L" | "piece";

// ---------------------------------------------------------------------------
// Import from URL — scrapes + LLM-rewrites a recipe page into a meal draft.
// Never writes to the database; SeedMealScreen reviews/edits the draft and
// the admin explicitly saves, same "nothing auto-applies" principle as
// USDA grounding.
// ---------------------------------------------------------------------------

export type ImportedMealDraft = {
  name: string;
  description: string;
  category: "luto";
  prep_time: number | null;
  total_time: number | null;
  difficulty: "easy" | "medium" | "hard" | null;
  protein_type: string | null;
  servings: number;
  procedure: string[];
  allergens: string[];
  dietary_tags: string[];
  tags: string[];
  ingredients: { name: string; quantity_text: string }[];
  reference_image_url: string | null;
};

// Best-effort extraction of a numeric amount + this schema's unit enum from
// a recipe's free-text quantity ("2 pieces (diced)", "500 g", "1/4 cup").
// The AMOUNT is a fact about the recipe (how much THIS dish uses), not
// something derivable from the ingredients table — there's nothing to
// "calculate" there. What's genuinely automatable is reading the number
// that's already sitting in the text instead of leaving the field blank
// for the admin to retype by hand. Returns null (leave blank) rather than
// guess when the unit has no fixed equivalent in this schema's units at
// all (e.g. "a pinch", "to taste") — this project doesn't invent
// conversions it can't verify.
const UNIT_WORDS: Record<string, QuantityUnit> = {
  g: "g", gram: "g", grams: "g",
  kg: "kg", kilogram: "kg", kilograms: "kg",
  ml: "ml", milliliter: "ml", milliliters: "ml", millilitre: "ml", millilitres: "ml",
  l: "L", liter: "L", liters: "L", litre: "L", litres: "L",
  piece: "piece", pieces: "piece", pc: "piece", pcs: "piece",
  clove: "piece", cloves: "piece", whole: "piece",
  stalk: "piece", stalks: "piece",
  bunch: "piece", bunches: "piece",
  sprig: "piece", sprigs: "piece",
  head: "piece", heads: "piece",
  ear: "piece", ears: "piece",
  rib: "piece", ribs: "piece",
  bulb: "piece", bulbs: "piece",
  slice: "piece", slices: "piece",
  thumb: "piece", thumbs: "piece", knob: "piece", knobs: "piece",
  // Size qualifiers on a countable produce item ("1 medium potato", "2
  // large onions") — these were previously captured by the regex as the
  // "unit" word (right after the number, before the ingredient name) and
  // failed to match anything, leaving the quantity blank. "medium" is the
  // baseline (grams_per_piece is estimated as a typical/medium piece, per
  // this project's own seeding convention) so it scales by 1; small/large
  // scale relative to it via UNIT_SCALE below, same mechanism as lb/oz.
  medium: "piece", small: "piece", large: "piece", big: "piece", extra: "piece",
  lb: "kg", lbs: "kg", pound: "kg", pounds: "kg",
  oz: "g", ounce: "g", ounces: "g",
  tbsp: "ml", tbsps: "ml", tablespoon: "ml", tablespoons: "ml",
  tsp: "ml", tsps: "ml", teaspoon: "ml", teaspoons: "ml",
  cup: "ml", cups: "ml",
};
// lb/oz aren't native units here — converted to this schema's nearest
// weight unit at parse time (universal unit math, not ingredient-specific).
// Same for tbsp/tsp/cup -> ml: these are volume units by definition, so the
// conversion is exact regardless of what's being measured — unlike
// volume-to-WEIGHT (e.g. "1 cup flour" -> grams), which does depend on the
// ingredient's density and is deliberately left to convertQuantityToBasis's
// per-ingredient grams_per_ml bridge, not guessed here.
//
// small/large/big are rough (0.7x / 1.5x a medium piece) — close enough for
// a draft the admin reviews, same spirit as this project's other estimates.
// "extra" alone (e.g. a stray "extra large") isn't scaled further here;
// it just resolves to a plain piece rather than blocking the parse.
const UNIT_SCALE: Partial<Record<string, number>> = {
  lb: 0.453592, lbs: 0.453592, pound: 0.453592, pounds: 0.453592,
  oz: 28.3495, ounce: 28.3495, ounces: 28.3495,
  tbsp: 14.7868, tbsps: 14.7868, tablespoon: 14.7868, tablespoons: 14.7868,
  tsp: 4.92892, tsps: 4.92892, teaspoon: 4.92892, teaspoons: 4.92892,
  cup: 236.588, cups: 236.588,
  small: 0.7, large: 1.5, big: 1.5,
};

// Recipe sites commonly write fractions as a single Unicode glyph ("½ cup")
// rather than ASCII "1/2" — invisible to \d, so the whole parse would
// otherwise fail silently. Normalized to ASCII before anything else runs.
// A digit immediately before the glyph (no space) means a mixed number
// written without a space ("1½ cups") — insert one so it flows into the
// mixed-number pattern below; a bare glyph ("½ cup") just becomes "1/2".
const UNICODE_FRACTIONS: Record<string, string> = {
  "½": "1/2", "⅓": "1/3", "⅔": "2/3", "¼": "1/4", "¾": "3/4",
  "⅕": "1/5", "⅖": "2/5", "⅗": "3/5", "⅘": "4/5",
  "⅙": "1/6", "⅚": "5/6", "⅐": "1/7", "⅛": "1/8", "⅜": "3/8", "⅝": "5/8", "⅞": "7/8",
  "⅑": "1/9", "⅒": "1/10",
};
function normalizeUnicodeFractions(text: string): string {
  return text.replace(/(\d)?([½⅓⅔¼¾⅕⅖⅗⅘⅙⅚⅐⅛⅜⅝⅞⅑⅒])/g, (_m, digit: string | undefined, glyph: string) => {
    const ascii = UNICODE_FRACTIONS[glyph];
    return digit ? `${digit} ${ascii}` : ascii;
  });
}

export function parseQuantityText(text: string): { amount: string; unit: QuantityUnit } | null {
  const trimmed = normalizeUnicodeFractions(text.trim());

  // Mixed number first (e.g. "1 1/2 cups") — must be tried before the
  // plain pattern below, since that one matches just the leading "1" and
  // then fails on " 1/2 cups" (a space, not a unit word), returning null
  // for a quantity that's actually perfectly parseable.
  const mixed = trimmed.match(/^(\d+)\s+(\d+)\s*\/\s*(\d+)\s*([a-zA-Z]+)/);
  if (mixed) {
    const whole = Number(mixed[1]);
    const numerator = Number(mixed[2]);
    const denominator = Number(mixed[3]);
    const unitWord = mixed[4].toLowerCase();
    const unit = UNIT_WORDS[unitWord];
    if (!unit) return null;
    const scale = UNIT_SCALE[unitWord] ?? 1;
    return { amount: ((whole + numerator / denominator) * scale).toString(), unit };
  }

  // Leading number, optionally a simple fraction (e.g. "1/4"), optionally
  // followed by "to N" (a range — take the first number, close enough for
  // a draft the admin reviews anyway).
  const match = trimmed.match(/^(\d+(?:\.\d+)?)(?:\s*\/\s*(\d+))?\s*([a-zA-Z]+)/);
  if (!match) return null;
  const whole = Number(match[1]);
  const denominator = match[2] ? Number(match[2]) : null;
  const amount = denominator ? whole / denominator : whole;
  const unitWord = match[3].toLowerCase();
  const unit = UNIT_WORDS[unitWord];
  if (!unit) return null;
  const scale = UNIT_SCALE[unitWord] ?? 1;
  return { amount: (amount * scale).toString(), unit };
}

export async function importMealFromUrl(url: string) {
  return invokeEdgeFunction<{ meal: ImportedMealDraft; extraction_tier: "json-ld" | "raw-text" }>(
    "import-meal-from-url",
    { url },
  );
}

export type MealFilters = {
  category?: string;
  showArchived?: boolean;
  search?: string;
};

// The catalog: approved meals only. User-submitted recipes that are still
// pending (or were rejected) live in the same table but stay out of every
// consumer screen and Manage Meals; the admin sees those in Review Recipes
// (api/recipes.ts). See migration 20261003030000_meals_moderation.sql.
export async function getMeals(filters: MealFilters = {}) {
  let query = supabase.from("meals").select("*").eq("status", "approved").order("name");

  if (!filters.showArchived) {
    query = query.is("archived_at", null);
  }
  if (filters.category) {
    query = query.eq("category", filters.category);
  }
  if (filters.search) {
    query = query.ilike("name", `%${filters.search}%`);
  }

  const { data, error } = await query;
  if (error) throw error;
  return data;
}

// Which ingredients each catalog meal uses (ids, names, Main/Pantry role), for matching
// meals against the user's pantry. Same visibility as getMeals: approved,
// not archived.
export async function getMealIngredientIndex() {
  const { data, error } = await supabase
    .from("meals")
    .select("id, name, meal_ingredients(ingredient_id, ingredient:ingredients(canonical_name, role))")
    .eq("status", "approved")
    .is("archived_at", null);
  if (error) throw error;
  return data;
}

export type BrowseQuery = {
  q?: string;
  dietaryTags: string[];
  tags: string[];
  restaurants: string[];
  priceRange: [number, number] | null;
};

// Older seeded meals use camelCase tags ("highProtein") while newer ones
// and the filter values are snake_case ("high_protein"): match both.
const toCamel = (tag: string) => tag.replace(/_([a-z])/g, (_, c: string) => c.toUpperCase());

// The web filter sends "Mcdonald's" (sic) and matches exactly, so a
// "McDonald's" row would never match. Send both spellings.
function restaurantVariants(restaurants: string[]) {
  return [...new Set(restaurants.flatMap((r) => (/^mcdonald's$/i.test(r) ? ["Mcdonald's", "McDonald's"] : [r])))];
}

// Browse search (the web's browseMealsByFilter, same rules as its server):
// approved catalog only; `q` is a case-insensitive substring of the name OR
// the restaurant; OR within a filter group, AND across groups; price is the
// base price. Unordered: the caller shuffles or sorts.
export async function browseMeals(query: BrowseQuery) {
  let request = supabase.from("meals").select("*").eq("status", "approved").is("archived_at", null);

  // Characters PostgREST's or() syntax treats as separators/wildcards.
  const q = query.q?.trim().replace(/[,()*%\\]/g, " ").trim();
  if (q) request = request.or(`name.ilike.%${q}%,restaurant.ilike.%${q}%`);
  if (query.tags.length > 0) request = request.overlaps("tags", [...new Set(query.tags.flatMap((t) => [t, toCamel(t)]))]);
  if (query.dietaryTags.length > 0) request = request.overlaps("dietary_tags", query.dietaryTags);
  if (query.restaurants.length > 0) request = request.in("restaurant", restaurantVariants(query.restaurants));
  if (query.priceRange) request = request.gte("price", query.priceRange[0]).lte("price", query.priceRange[1]);

  const { data, error } = await request;
  if (error) throw error;
  return data;
}

export async function getMeal(id: string): Promise<MealWithIngredients> {
  const { data, error } = await supabase
    .from("meals")
    .select(
      "*, meal_ingredients(*, ingredient:ingredients(*, da_commodities(id, commodity, specification, unit, unit_size, latest_price, latest_price_date)))",
    )
    .eq("id", id)
    .single();
  if (error) throw error;
  return data as unknown as MealWithIngredients;
}

export async function createMeal(patch: Partial<MealRow> & { name: string }) {
  const { data, error } = await supabase.from("meals").insert(patch).select().single();
  if (error) throw error;
  return data;
}

export async function updateMeal(id: string, patch: Partial<MealRow>) {
  const { data, error } = await supabase
    .from("meals")
    .update(patch)
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function archiveMeal(id: string) {
  return updateMeal(id, { archived_at: new Date().toISOString() });
}

// Hard delete — permanent, unlike archiveMeal's reversible hide. Its
// meal_ingredients rows cascade-delete with it (on delete cascade), so no
// manual cleanup needed there — but its uploaded photo(s) live in Storage
// (uploadMealImage's `${mealId}/...` path), which the DB delete has no
// knowledge of, so that's cleaned up explicitly here. Best-effort: a
// Storage hiccup shouldn't block the meal from actually being deleted, and
// an orphaned image file is a harmless leftover, not a correctness issue.
export async function deleteMeal(id: string) {
  try {
    const { data: files } = await supabase.storage.from("meal-images").list(id);
    if (files && files.length > 0) {
      await supabase.storage.from("meal-images").remove(files.map((f) => `${id}/${f.name}`));
    }
  } catch {
    // ignore — see comment above
  }

  const { error } = await supabase.from("meals").delete().eq("id", id);
  if (error) throw error;
}

export type MealIngredientInput = {
  ingredient_id: string;
  quantity_amount: number | null;
  quantity_unit: string | null;
  display_text: string;
  sort_order?: number;
  // General-purpose annotation shown to every viewer when the counted
  // quantity differs from what display_text states and needs a short
  // explanation (e.g. bulk deep-frying oil where only a fraction is
  // actually absorbed) — not oil-specific.
  note?: string | null;
  // Overrides the quantity PRICE is computed from, independent of the
  // quantity macros are computed from — e.g. bulk deep-frying oil, where
  // the cook buys/uses a full cup (price) but the dish only absorbs a
  // fraction of it (macros). Null (the default) means price falls back to
  // quantity_amount/quantity_unit, unchanged from before this existed.
  price_quantity_amount?: number | null;
  price_quantity_unit?: string | null;
};

export async function addMealIngredient(mealId: string, input: MealIngredientInput) {
  const { data, error } = await supabase
    .from("meal_ingredients")
    .insert({ meal_id: mealId, ...input })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function updateMealIngredient(id: string, patch: Partial<MealIngredientRow>) {
  const { data, error } = await supabase
    .from("meal_ingredients")
    .update(patch)
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function deleteMealIngredient(id: string) {
  const { error } = await supabase.from("meal_ingredients").delete().eq("id", id);
  if (error) throw error;
}

// Edit Meal replaces the full ingredient list on save rather than diffing
// add/update/delete against the original set — these are cheap join-table
// rows with no history/comments tied to an individual row's id, so a clean
// replace is simpler and less error-prone than reconciling a diff.
export async function replaceMealIngredients(mealId: string, inputs: MealIngredientInput[]) {
  const { error: deleteError } = await supabase.from("meal_ingredients").delete().eq("meal_id", mealId);
  if (deleteError) throw deleteError;
  if (inputs.length === 0) return;
  const { error: insertError } = await supabase
    .from("meal_ingredients")
    .insert(inputs.map((input) => ({ meal_id: mealId, ...input })));
  if (insertError) throw insertError;
}

// Uploads a locally-picked image (expo-image-picker's file:// URI) to the
// meal-images Storage bucket and returns its public URL. Path is namespaced
// by mealId so repeated edits of the same meal don't collide, timestamped
// so successive uploads for the same meal don't silently overwrite a URL
// still cached/displayed elsewhere before the admin confirms the change.
export async function uploadMealImage(localUri: string, mealId: string): Promise<string> {
  const response = await fetch(localUri);
  const blob = await response.blob();
  const ext = localUri.split(".").pop()?.toLowerCase().split("?")[0] || "jpg";
  const path = `${mealId}/${Date.now()}.${ext}`;

  const { error } = await supabase.storage.from("meal-images").upload(path, blob, {
    contentType: blob.type || `image/${ext}`,
    upsert: true,
  });
  if (error) throw error;

  const { data } = supabase.storage.from("meal-images").getPublicUrl(path);
  return data.publicUrl;
}

// AI-generated meal photo, for when there's no real photo to upload (or the
// admin wants an alternative). referenceImageUrl (this meal's
// reference_image_url, the original recipe photo captured at import) is
// used only to give the model a sense of real plating/composition — the
// Edge Function has a vision model describe it in neutral text first and
// generates the final image from THAT description, never from the image's
// own pixels, so the result is inspired by it without copying it. Returns a
// draft only; the caller shows a preview and uploads it via uploadMealImage
// (through the same compression pipeline as a manually-picked photo) only
// once the admin accepts it — nothing is written to Storage here.
export async function generateMealImage(input: {
  name: string;
  description: string | null;
  referenceImageUrl?: string | null;
}): Promise<{ imageBase64: string; mimeType: string }> {
  const data = await invokeEdgeFunction<{ imageBase64: string; mimeType: string }>("generate-meal-image", input);
  if (!data.imageBase64) throw new Error("Image generation returned no data");
  return data;
}

// ---------------------------------------------------------------------------
// Ingredient matching — ranks candidates from OUR OWN ingredients table
// against a free-text name the admin typed while building a meal. Distinct
// from USDA grounding (api/ingredients.ts's groundIngredientsUsda), which
// matches a canonical ingredient's name against USDA's external database;
// this matches an as-typed meal-ingredient name against ingredients we
// already have. No external calls — small enough table (~500 rows) to fetch
// and score client-side.
// ---------------------------------------------------------------------------

export async function getIngredientsForMatching() {
  const { data, error } = await supabase
    .from("ingredients")
    .select("*")
    .is("archived_at", null);
  if (error) throw error;
  return data;
}

const STOPWORDS = new Set(["raw", "cooked", "fried", "dried", "the", "and", "of", "a", "in", "with", "fresh"]);

function significantWords(text: string): string[] {
  return text
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((w) => w.length > 1 && !STOPWORDS.has(w));
}

// Word-overlap scoring, same family as the USDA grounding function's
// hasWordOverlap check but scoring rather than pass/fail: canonical_name
// matches weighted highest, alias matches count too (unlike the word
// "search_term" pattern in some reference implementations, this project's
// `aliases` are genuinely per-ingredient synonyms — e.g. "bawang" only on
// Garlic, not a shared generic bucket across many rows — so weighting them
// doesn't reintroduce the "Garlic auto-matches Garlic Powder via a shared
// generic term" class of bug).
export function scoreIngredientMatch(query: string, ingredient: IngredientRow): number {
  const queryWords = new Set(significantWords(query));
  if (queryWords.size === 0) return 0;

  const nameWords = significantWords(ingredient.canonical_name);
  const nameOverlap = nameWords.filter((w) => queryWords.has(w)).length;

  const aliasWords = ingredient.aliases.flatMap(significantWords);
  const aliasOverlap = aliasWords.filter((w) => queryWords.has(w)).length;

  let score = nameOverlap * 3 + aliasOverlap;
  if (nameWords.length > 0 && nameOverlap === nameWords.length) {
    score += 2; // full canonical-name coverage bonus
  }
  return score;
}

export type IngredientMatchCandidate = {
  ingredient: IngredientRow;
  score: number;
  // HIGH when every word of the ingredient's canonical name was found in
  // the query (the same "full coverage" signal scoreIngredientMatch's
  // bonus is based on) — a meaningful match-quality signal, unlike the raw
  // word-overlap score which has no fixed scale for an admin to read.
  confidence: "HIGH" | "LOW";
};

function localMatchConfidence(query: string, ingredient: IngredientRow): "HIGH" | "LOW" {
  const queryWords = new Set(significantWords(query));
  const nameWords = significantWords(ingredient.canonical_name);
  const nameOverlap = nameWords.filter((w) => queryWords.has(w)).length;
  return nameWords.length > 0 && nameOverlap === nameWords.length ? "HIGH" : "LOW";
}

export function matchIngredientCandidates(
  query: string,
  allIngredients: IngredientRow[],
  limit = 5,
): IngredientMatchCandidate[] {
  return allIngredients
    .map((ingredient) => ({
      ingredient,
      score: scoreIngredientMatch(query, ingredient),
      confidence: localMatchConfidence(query, ingredient),
    }))
    .filter((c) => c.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}

// ---------------------------------------------------------------------------
// Quantity conversion — the same "universal unit math + per-ingredient
// bridge" model as docs/ingredient-data-architecture.md: g<->kg and ml<->L
// are ingredient-independent; going between weight and volume/piece needs
// the ingredient's own grams_per_ml/grams_per_piece bridge. Converts into
// whatever basis_unit that ingredient's macros are actually stored in
// ('g' or 'ml'), since not everything is stored per-100g (liquid dairy,
// vinegars, etc. use per-100ml).
// ---------------------------------------------------------------------------

export type QuantityConversion =
  | { ok: true; basisAmount: number; basisUnit: string }
  | { ok: false; reason: string };

export function convertQuantityToBasis(
  amount: number,
  unit: string,
  ingredient: IngredientRow,
): QuantityConversion {
  let grams: number | null = null;
  let ml: number | null = null;

  if (unit === "g") grams = amount;
  else if (unit === "kg") grams = amount * 1000;
  else if (unit === "ml") ml = amount;
  else if (unit === "L") ml = amount * 1000;
  else if (unit === "piece") {
    if (ingredient.grams_per_piece == null) {
      return { ok: false, reason: `${ingredient.canonical_name} has no grams_per_piece bridge set` };
    }
    grams = amount * ingredient.grams_per_piece;
  } else {
    return { ok: false, reason: `Unrecognized unit "${unit}"` };
  }

  if (ingredient.basis_unit === "g") {
    if (grams != null) return { ok: true, basisAmount: grams, basisUnit: "g" };
    // have ml, need grams
    if (ingredient.grams_per_ml == null) {
      return { ok: false, reason: `${ingredient.canonical_name} has no grams_per_ml bridge set` };
    }
    return { ok: true, basisAmount: (ml as number) * ingredient.grams_per_ml, basisUnit: "g" };
  }

  if (ingredient.basis_unit === "ml") {
    if (ml != null) return { ok: true, basisAmount: ml, basisUnit: "ml" };
    // have grams, need ml
    if (ingredient.grams_per_ml == null) {
      return { ok: false, reason: `${ingredient.canonical_name} has no grams_per_ml bridge set` };
    }
    return { ok: true, basisAmount: (grams as number) / ingredient.grams_per_ml, basisUnit: "ml" };
  }

  return { ok: false, reason: `${ingredient.canonical_name} has an unrecognized basis_unit "${ingredient.basis_unit}"` };
}

export type ProposedTotals = {
  calories: number | null;
  protein: number | null;
  carbohydrates: number | null;
  fat: number | null;
  price: number | null;
};

// Scales an ingredient's per-basis_amount macros/price to the actual
// quantity used. Price is scaled independently since estimated_price_unit
// isn't always the same unit as basis_unit (e.g. priced per 'kg' while
// macros are stored per-100'g') — assumes price_unit and basis_unit share
// the same weight-vs-volume domain, true for every ingredient seeded so
// far; returns a null price rather than guessing if they don't.
export function computeProposedTotals(ingredient: IngredientRow, conversion: QuantityConversion): ProposedTotals {
  if (!conversion.ok) {
    return { calories: null, protein: null, carbohydrates: null, fat: null, price: null };
  }
  const macroScale = conversion.basisAmount / ingredient.basis_amount;
  const scaleOrNull = (v: number | null) => (v == null ? null : v * macroScale);

  let price: number | null = null;
  if (ingredient.estimated_price != null && ingredient.estimated_price_unit) {
    const priceUnit = ingredient.estimated_price_unit;
    const isWeightUnit = priceUnit === "g" || priceUnit === "kg";
    const isVolumeUnit = priceUnit === "ml" || priceUnit === "L";
    const conversionIsWeight = conversion.basisUnit === "g";
    const conversionIsVolume = conversion.basisUnit === "ml";
    if ((isWeightUnit && conversionIsWeight) || (isVolumeUnit && conversionIsVolume)) {
      const unitBase = priceUnit === "kg" || priceUnit === "L" ? 1000 : 1;
      price = (ingredient.estimated_price / unitBase) * conversion.basisAmount;
    }
  }

  return {
    calories: scaleOrNull(ingredient.calories),
    protein: scaleOrNull(ingredient.protein),
    carbohydrates: scaleOrNull(ingredient.carbohydrates),
    fat: scaleOrNull(ingredient.fat),
    price,
  };
}

// Macros and price can reflect DIFFERENT effective quantities for the same
// row — e.g. bulk deep-frying oil, where the cook buys/uses a full cup
// (what price should reflect) but the dish only absorbs a fraction of it
// (what macros should reflect). priceQuantityAmount/Unit override the
// quantity price is computed from; when either is null, price falls back
// to the same quantity macros use (the common case — nothing overridden).
export function computeItemTotals(
  ingredient: IngredientRow,
  quantityAmount: number,
  quantityUnit: string,
  priceQuantityAmount?: number | null,
  priceQuantityUnit?: string | null,
): ProposedTotals {
  const macroConversion = convertQuantityToBasis(quantityAmount, quantityUnit, ingredient);
  const macroTotals = computeProposedTotals(ingredient, macroConversion);

  const hasOverride = priceQuantityAmount != null && priceQuantityUnit != null;
  const priceTotals = hasOverride
    ? computeProposedTotals(ingredient, convertQuantityToBasis(priceQuantityAmount, priceQuantityUnit, ingredient))
    : macroTotals;

  return { ...macroTotals, price: priceTotals.price };
}

// ---------------------------------------------------------------------------
// Recompute a meal's cached totals from its current meal_ingredients — sums
// EVERY ingredient with a usable quantity, main and pantry alike (since
// 2026-10-03). Pantry items used to be excluded except oils, which
// undercounted calories (sugar, coconut milk, sauces) and understated the
// real per-meal cost. `role` is now only a display label (Main / Pantry),
// not a counting rule. Unquantified items ("to taste") still contribute
// nothing, since there's no amount to compute from. Call explicitly after
// binding/editing ingredients; nothing recomputes automatically.
// ---------------------------------------------------------------------------

export async function recomputeMealTotals(mealId: string) {
  const meal = await getMeal(mealId);
  let calories = 0;
  let protein = 0;
  let carbohydrates = 0;
  let fat = 0;
  let price = 0;

  for (const mi of meal.meal_ingredients) {
    if (mi.quantity_amount == null || mi.quantity_unit == null) continue;
    const totals = computeItemTotals(
      mi.ingredient,
      mi.quantity_amount,
      mi.quantity_unit,
      mi.price_quantity_amount,
      mi.price_quantity_unit,
    );
    calories += totals.calories ?? 0;
    protein += totals.protein ?? 0;
    carbohydrates += totals.carbohydrates ?? 0;
    fat += totals.fat ?? 0;
    price += totals.price ?? 0;
  }

  return updateMeal(mealId, {
    calories,
    protein,
    carbohydrates,
    fat,
    price,
    ingredients_synced_at: new Date().toISOString(),
  });
}

// ---------------------------------------------------------------------------
// AI Verify — runs AFTER the admin has manually linked/bridged every
// ingredient in Seed Meal (matching/bridging itself is never touched here —
// stays fully manual, admin-triggered, exactly as SeedMealIngredientsEditor
// already works). Audits the RESULT: total macros/price, each ingredient's
// computed contribution, and whether its bridge/price-unit/state actually
// hold up for this specific recipe — the same kind of review this project's
// own ingredient batches have gotten by hand this session (catching e.g. a
// canned/drained ingredient linked to its raw/dry variant, or an oil's
// price unit not matching its basis unit), run automatically instead.
// Returns proposed field-level fixes only; nothing is written to the
// ingredients table until the admin accepts an individual issue in
// MealVerifyPanel — same "grounding never silently applies" principle as
// this project's other AI features.
// ---------------------------------------------------------------------------

export type MealVerifyField =
  | "calories" | "protein" | "carbohydrates" | "fat" | "sugar" | "fiber" | "sodium"
  | "estimated_price" | "estimated_price_unit" | "grams_per_ml" | "grams_per_piece"
  | "piece_label" | "state" | "role";

export type MealVerifyIssue = {
  ingredientName: string;
  field: MealVerifyField;
  issue: string;
  currentValue: string;
  suggestedValue: string;
  reasoning: string;
};

export type MealVerifyResult = {
  summary: string;
  overallAssessment: "plausible" | "concerning";
  issues: MealVerifyIssue[];
};

export type MealVerifyIngredientInput = {
  displayText: string;
  quantityAmount: number | null;
  quantityUnit: string | null;
  ingredient: IngredientRow;
  computed: ProposedTotals;
};

export async function verifyMealIngredients(
  meal: { name: string; description: string | null; servingSize: number; category: string | null },
  items: MealVerifyIngredientInput[],
  totals: ProposedTotals,
): Promise<MealVerifyResult> {
  const data = await invokeEdgeFunction<{ verification: MealVerifyResult }>("verify-meal-ingredients", {
    meal,
    ingredients: items.map((item) => ({
      name: item.ingredient.canonical_name,
      displayText: item.displayText,
      quantityAmount: item.quantityAmount,
      quantityUnit: item.quantityUnit,
      role: item.ingredient.role,
      category: item.ingredient.category,
      state: item.ingredient.state,
      source: item.ingredient.source,
      basisAmount: item.ingredient.basis_amount,
      basisUnit: item.ingredient.basis_unit,
      calories: item.ingredient.calories,
      protein: item.ingredient.protein,
      carbohydrates: item.ingredient.carbohydrates,
      fat: item.ingredient.fat,
      sugar: item.ingredient.sugar,
      fiber: item.ingredient.fiber,
      sodium: item.ingredient.sodium,
      estimatedPrice: item.ingredient.estimated_price,
      estimatedPriceUnit: item.ingredient.estimated_price_unit,
      gramsPerMl: item.ingredient.grams_per_ml,
      gramsPerPiece: item.ingredient.grams_per_piece,
      pieceLabel: item.ingredient.piece_label,
      computed: item.computed,
    })),
    totals,
  });
  if (!data.verification) throw new Error("Verify returned no data");
  return data.verification;
}

const MEAL_VERIFY_NUMERIC_FIELDS = new Set<MealVerifyField>([
  "calories", "protein", "carbohydrates", "fat", "sugar", "fiber", "sodium",
  "estimated_price", "grams_per_ml", "grams_per_piece",
]);

// Nutrition (+ state, which only ever matters in service of a nutrition
// correction) is real, already-verified USDA reference data once an
// ingredient's source is "USDA" — never a fix target, no matter what the
// verify prompt returns. Mirrors the SOURCE rule in
// verify-meal-ingredients's SYSTEM_PROMPT; enforced here too as the actual
// hard rule, in case a response ever ignores the instruction.
const MEAL_VERIFY_USDA_LOCKED_FIELDS = new Set<MealVerifyField>([
  "calories", "protein", "carbohydrates", "fat", "sugar", "fiber", "sodium", "state",
]);

export function isMealVerifyFieldAllowedForSource(field: MealVerifyField, ingredientSource: string | null): boolean {
  return !(ingredientSource === "USDA" && MEAL_VERIFY_USDA_LOCKED_FIELDS.has(field));
}

// Nutrition can legitimately be 0 (e.g. fat in a vegetable); a price or a
// bridge of 0 would zero out every meal built on the ingredient.
const MEAL_VERIFY_POSITIVE_FIELDS = new Set<MealVerifyField>([
  "estimated_price", "grams_per_ml", "grams_per_piece",
]);

// Mirrors the ingredients table's CHECK constraints (ingredients_price_unit_check,
// ingredients_role_check) and IngredientEditSheet's STATE_OPTIONS. Spelled-out
// variants the LLM tends to return ("kilogram", "liter") map to the stored unit.
const PRICE_UNIT_ALIASES: Record<string, string> = {
  g: "g", gram: "g", grams: "g",
  kg: "kg", kilo: "kg", kilos: "kg", kilogram: "kg", kilograms: "kg",
  ml: "ml", milliliter: "ml", milliliters: "ml", millilitre: "ml", millilitres: "ml",
  l: "L", liter: "L", liters: "L", litre: "L", litres: "L",
};
const MEAL_VERIFY_ROLES = new Set(["main", "pantry"]);
const MEAL_VERIFY_STATES = new Set(["raw", "cooked", "fried", "dried"]);

export type MealVerifyFixParse =
  | { ok: true; patch: Partial<IngredientRow> }
  | { ok: false; reason: string };

// The LLM always returns suggestedValue as a string (simplest, unambiguous
// JSON-mode shape) — parses it back into the right type for the field it
// names before it can be used as an updateIngredient patch. Rejects anything
// it can't map cleanly instead of guessing: a NaN used to be written as null
// (silently wiping the field while the card said "Applied"), and an
// off-list unit/role failed the DB's CHECK constraint.
export function parseMealVerifyFixValue(field: MealVerifyField, value: string): MealVerifyFixParse {
  const raw = value.trim();

  if (MEAL_VERIFY_NUMERIC_FIELDS.has(field)) {
    // Tolerates a currency prefix / unit suffix ("₱250", "0.92 g/ml") but
    // not a range or a second number ("0.91-0.92", "250 per 1 kg"), which
    // would mean picking one for the admin.
    const numbers = raw.replace(/,/g, "").match(/\d+(\.\d+)?/g);
    if (!numbers || numbers.length !== 1) {
      return { ok: false, reason: `Couldn't read "${value}" as a single number for ${field}. Edit it in Manage Ingredients instead.` };
    }
    const num = Number(numbers[0]);
    if (MEAL_VERIFY_POSITIVE_FIELDS.has(field) && num === 0) {
      return { ok: false, reason: `${field} can't be 0.` };
    }
    return { ok: true, patch: { [field]: num } };
  }

  const normalized = raw.toLowerCase().replace(/^(per|\/)\s*/, "");
  switch (field) {
    case "estimated_price_unit": {
      const unit = PRICE_UNIT_ALIASES[normalized];
      if (!unit) return { ok: false, reason: `"${value}" isn't a valid price unit. Prices can only be per g, kg, ml, or L.` };
      return { ok: true, patch: { estimated_price_unit: unit } };
    }
    case "role":
      if (!MEAL_VERIFY_ROLES.has(normalized)) return { ok: false, reason: `"${value}" isn't a valid role (main or pantry).` };
      return { ok: true, patch: { role: normalized } };
    case "state":
      if (!MEAL_VERIFY_STATES.has(normalized)) return { ok: false, reason: `"${value}" isn't a valid state (raw, cooked, fried, or dried).` };
      return { ok: true, patch: { state: normalized } };
    default:
      if (raw === "") return { ok: false, reason: `Suggested ${field} is empty.` };
      return { ok: true, patch: { [field]: raw } };
  }
}

// Cascades an ingredient's data change to every meal that references it —
// called from useUpdateIngredient's onSuccess (the single chokepoint both
// IngredientEditSheet and the batch UsdaGroundingPanel go through), so a
// re-grounded or manually corrected ingredient's macros/price don't go
// silently stale on meals built from it before the edit.
export async function recomputeMealsUsingIngredient(ingredientId: string) {
  const { data, error } = await supabase
    .from("meal_ingredients")
    .select("meal_id")
    .eq("ingredient_id", ingredientId);
  if (error) throw error;

  const mealIds = Array.from(new Set((data ?? []).map((row) => row.meal_id)));
  await Promise.all(mealIds.map((id) => recomputeMealTotals(id)));
  return mealIds;
}

// Read-only preview of recomputeMealsUsingIngredient's blast radius — names
// of every non-archived meal that references any of the given ingredient
// ids, deduplicated. Used to show an admin "this will affect N meals: ..."
// before an ingredient edit actually happens, across every path that can
// write to the shared ingredients table (Manage Ingredients, USDA
// grounding's batch apply, AI Verify's accepted fixes, Seed Meal's
// "Suggest bridge with AI") — accepts multiple ids so a batch operation
// gets one combined list, not one lookup per ingredient.
export async function getMealsUsingIngredients(ingredientIds: string[]): Promise<{ id: string; name: string }[]> {
  if (ingredientIds.length === 0) return [];
  const { data, error } = await supabase
    .from("meal_ingredients")
    .select("meal:meals!inner(id, name, archived_at)")
    .in("ingredient_id", ingredientIds)
    .is("meal.archived_at", null);
  if (error) throw error;

  const seen = new Map<string, string>();
  for (const row of data ?? []) {
    const meal = row.meal as unknown as { id: string; name: string } | null;
    if (meal) seen.set(meal.id, meal.name);
  }
  return Array.from(seen, ([id, name]) => ({ id, name }));
}
