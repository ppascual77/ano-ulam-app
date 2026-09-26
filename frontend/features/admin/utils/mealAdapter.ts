import { computeProposedTotals, convertQuantityToBasis, type MealRow, type MealWithIngredients } from "@/api/meals";
import type { IngredientType, MealType } from "@/frontend/core/meals/mealTypes";

// Bridges this project's real `meals`/`meal_ingredients` schema into the
// mock-era `MealType` shape that MealCard/MealDetailSheet (used throughout
// Home/Browse/MealList) already render — reused as-is rather than forked
// into an admin-only card/detail pair, per the explicit ask: "the only
// thing is, Manage Meal will pass out true and existing value from DB."
// Field-name differences (carbohydrates/fat -> carbs/fats, price as a
// number -> string) are exactly what this adapter exists to absorb.
export function mealRowToMealType(meal: MealRow, mealIngredients?: MealWithIngredients["meal_ingredients"]): MealType {
  return {
    id: meal.id,
    name: meal.name,
    description: meal.description ?? "",
    category: meal.category ?? undefined,
    price: (meal.price ?? 0).toString(),
    budget_range: meal.budget_range ?? undefined,
    calories: meal.calories ?? 0,
    protein: meal.protein ?? 0,
    carbs: meal.carbohydrates ?? 0,
    fats: meal.fat ?? 0,
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
    // No likes/saves/moderation backend yet — always the same neutral
    // defaults every admin-viewed meal gets, not per-viewer state.
    like_count: 0,
    liked_by_me: false,
    poster_id: null,
    status: undefined,
    rejection_reason: null,
  };
}

function mealIngredientToIngredientType(
  mi: MealWithIngredients["meal_ingredients"][number],
): IngredientType & { sortOrder: number } {
  // The detail sheet's "Show details" toggle expects each ingredient's OWN
  // calories/price to be its actual contribution at the quantity used in
  // this recipe (it later multiplies by a servings scale factor) — not the
  // per-100g figure stored on the ingredient row. Same conversion
  // recomputeMealTotals itself uses.
  const conversion =
    mi.quantity_amount != null && mi.quantity_unit != null
      ? convertQuantityToBasis(mi.quantity_amount, mi.quantity_unit, mi.ingredient)
      : null;
  const totals = conversion?.ok ? computeProposedTotals(mi.ingredient, conversion) : null;

  const bridgeParts: string[] = [];
  if (mi.ingredient.grams_per_piece != null) {
    bridgeParts.push(`${mi.ingredient.grams_per_piece}g per ${mi.ingredient.piece_label ?? "piece"}`);
  }
  if (mi.ingredient.grams_per_ml != null) bridgeParts.push(`${mi.ingredient.grams_per_ml}g/ml`);

  return {
    sortOrder: mi.sort_order,
    qty: mi.display_text,
    name: mi.ingredient.canonical_name,
    type: (mi.ingredient.role as "main" | "pantry") ?? "pantry",
    calories: totals?.calories ?? undefined,
    protein: totals?.protein ?? undefined,
    carbs: totals?.carbohydrates ?? undefined,
    fats: totals?.fat ?? undefined,
    price: totals?.price ?? undefined,
    bridgeLabel: bridgeParts.length > 0 ? bridgeParts.join(" · ") : null,
    calculationError: conversion && !conversion.ok ? conversion.reason : null,
    source: mi.ingredient.source,
  };
}
