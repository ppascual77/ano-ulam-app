import { computeItemTotals, convertQuantityToBasis, type MealRow, type MealWithIngredients } from "@/api/meals";
import type { IngredientType, MealType, PriceSourceType } from "@/frontend/core/meals/mealTypes";
import { formatCount } from "./multiplyQty";

// Real computed totals carry long floating-point tails (e.g. summing many
// ingredients' scaled macros) that mock data never had — MealCard/
// MacroBreakdown/IngredientDetailSheet render whatever number they're
// given with no formatting of their own, so it's formatted once here at
// the source rather than patched into every display component downstream.
// Calories as a whole number (standard nutrition-label convention),
// protein/carbs/fat to 1 decimal, price to 2.
const roundCalories = (n: number | null | undefined) => Math.round(n ?? 0);
const roundMacro = (n: number | null | undefined) => Number((n ?? 0).toFixed(1));
const roundPrice = (n: number | null | undefined) => Number((n ?? 0).toFixed(2));

// Bridges this project's real `meals`/`meal_ingredients` schema into the
// mock-era `MealType` shape that MealCard/MealDetailSheet (used throughout
// Home/Browse/MealList) already render — reused as-is rather than forked
// into a parallel card/detail pair, per the original admin ask: "the only
// thing is, Manage Meal will pass out true and existing value from DB."
// Lives in core/meals/ (not a single feature's utils) since it's now
// reused by both admin (Manage Meals) and consumer (Home Recommendations)
// screens. Field-name differences (carbohydrates/fat -> carbs/fats, price
// as a number -> string) are exactly what this adapter exists to absorb.
export function mealRowToMealType(meal: MealRow, mealIngredients?: MealWithIngredients["meal_ingredients"]): MealType {
  return {
    id: meal.id,
    name: meal.name,
    description: meal.description ?? "",
    category: meal.category ?? undefined,
    price: roundPrice(meal.price).toFixed(2),
    budget_range: meal.budget_range ?? undefined,
    calories: roundCalories(meal.calories),
    protein: roundMacro(meal.protein),
    carbs: roundMacro(meal.carbohydrates),
    fats: roundMacro(meal.fat),
    prep_time: meal.prep_time ?? undefined,
    total_time: meal.total_time ?? undefined,
    difficulty: (meal.difficulty as MealType["difficulty"]) ?? undefined,
    protein_type: meal.protein_type ?? undefined,
    ingredients: mealIngredients ? mealIngredients.map(mealIngredientToIngredientType).sort((a, b) => a.sortOrder - b.sortOrder).map(({ sortOrder: _sortOrder, ...rest }) => rest) : undefined,
    procedure: meal.procedure ?? [],
    restaurant: meal.restaurant,
    source: meal.source,
    source_type: meal.source_type as MealType["source_type"],
    image_url: meal.image_url,
    allergens: meal.allergens ?? [],
    dietary_tags: meal.dietary_tags ?? [],
    tags: meal.tags ?? [],
    created_at: meal.created_at,
    image_attribution: meal.image_attribution,
    serving_size: meal.serving_size,
    updated_at: meal.updated_at,
    ingredients_synced_at: meal.ingredients_synced_at,
    // No likes backend yet: the same neutral defaults for every meal, not
    // per-viewer state.
    like_count: 0,
    liked_by_me: false,
    poster_id: meal.poster_id,
    status: meal.status,
    rejection_reason: meal.rejection_reason,
  };
}

// price_sources is jsonb, so its shape isn't enforced by the DB. Keep only
// entries with what the price source section actually needs to render.
function parsePriceSources(value: unknown): PriceSourceType[] {
  if (!Array.isArray(value)) return [];
  return value.filter(
    (s): s is PriceSourceType =>
      !!s && typeof s === "object" && typeof s.store === "string" && typeof s.url === "string" && typeof s.pricePerUnit === "number",
  );
}

// A recipe's display_text is usually a full quantity ("2 cloves, minced"),
// but sometimes just a number ("1"), which reads as "1 what?". In that case
// the quantity is rebuilt from the stored amount and unit: a count gets the
// ingredient's piece_label (or "piece"), and a weight/volume gets its unit.
const BARE_NUMBER = /^\s*\d+(\.\d+)?\s*$/;

function describeQuantity(
  mi: MealWithIngredients["meal_ingredients"][number],
): Pick<IngredientType, "qty" | "count"> {
  const text = mi.display_text;
  if (mi.quantity_amount == null || (text.trim() !== "" && !BARE_NUMBER.test(text))) return { qty: text };
  const unit = mi.quantity_unit;
  if (unit && unit !== "piece") return { qty: `${mi.quantity_amount} ${unit}` };
  const count = { amount: mi.quantity_amount, label: mi.ingredient.piece_label ?? "piece" };
  return { qty: formatCount(count.amount, count.label), count };
}

function mealIngredientToIngredientType(
  mi: MealWithIngredients["meal_ingredients"][number],
): IngredientType & { sortOrder: number } {
  // The detail sheet's "Show details" toggle expects each ingredient's OWN
  // calories/price to be its actual contribution at the quantity used in
  // this recipe (it later multiplies by a servings scale factor) — not the
  // per-100g figure stored on the ingredient row. Same computation
  // recomputeMealTotals itself uses, including the price_quantity_amount/
  // unit override (e.g. bulk frying oil: macros from the absorbed amount,
  // price from the full amount actually used).
  const conversion =
    mi.quantity_amount != null && mi.quantity_unit != null
      ? convertQuantityToBasis(mi.quantity_amount, mi.quantity_unit, mi.ingredient)
      : null;
  const totals =
    conversion?.ok && mi.quantity_amount != null && mi.quantity_unit != null
      ? computeItemTotals(mi.ingredient, mi.quantity_amount, mi.quantity_unit, mi.price_quantity_amount, mi.price_quantity_unit)
      : null;

  // Micronutrients use the same per-basis scaling as the macros above.
  const microScale = conversion?.ok ? conversion.basisAmount / mi.ingredient.basis_amount : null;
  const micro = (value: number | null, round: (n: number) => number) =>
    microScale != null && value != null ? round(value * microScale) : undefined;

  const bridgeParts: string[] = [];
  if (mi.ingredient.grams_per_piece != null) {
    bridgeParts.push(`${mi.ingredient.grams_per_piece}g per ${mi.ingredient.piece_label ?? "piece"}`);
  }
  if (mi.ingredient.grams_per_ml != null) bridgeParts.push(`${mi.ingredient.grams_per_ml}g/ml`);

  return {
    sortOrder: mi.sort_order,
    ...describeQuantity(mi),
    name: mi.ingredient.canonical_name,
    type: (mi.ingredient.role as "main" | "pantry") ?? "pantry",
    calories: totals?.calories != null ? roundCalories(totals.calories) : undefined,
    protein: totals?.protein != null ? roundMacro(totals.protein) : undefined,
    carbs: totals?.carbohydrates != null ? roundMacro(totals.carbohydrates) : undefined,
    fats: totals?.fat != null ? roundMacro(totals.fat) : undefined,
    fiber: micro(mi.ingredient.fiber, roundMacro),
    sugar: micro(mi.ingredient.sugar, roundMacro),
    sodium: micro(mi.ingredient.sodium, Math.round),
    price: totals?.price != null ? roundPrice(totals.price) : undefined,
    bridgeLabel: bridgeParts.length > 0 ? bridgeParts.join(" · ") : null,
    calculationError: conversion && !conversion.ok ? conversion.reason : null,
    source: mi.ingredient.source,
    sourceRefId: mi.ingredient.source_ref_id,
    sourceDescription: mi.ingredient.source_description,
    note: mi.note,
    category: mi.ingredient.category,
    priceSource: mi.ingredient.price_source,
    priceSources: parsePriceSources(mi.ingredient.price_sources),
  };
}
