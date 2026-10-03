import { formatCount, multiplyQty } from "./multiplyQty";
import type { IngredientType, MealType } from "../mealTypes";

// The ingredient as it should read at `scale` times its amount: quantity,
// price and macros all multiplied. Built in one place so the ingredient
// card and the detail sheet it opens can't disagree (the old inline panel
// once showed unscaled macros next to a scaled price).
export function scaleIngredient(ingredient: IngredientType, scale: number): IngredientType {
  return {
    ...ingredient,
    // A generated count re-pluralizes ("1 clove" -> "2 cloves"); free-text
    // quantities only get their leading number scaled.
    qty: ingredient.count
      ? formatCount(ingredient.count.amount * scale, ingredient.count.label)
      : multiplyQty(ingredient.qty, scale),
    count: ingredient.count ? { ...ingredient.count, amount: ingredient.count.amount * scale } : undefined,
    price: ingredient.price != null ? ingredient.price * scale : ingredient.price,
    calories: ingredient.calories != null ? ingredient.calories * scale : undefined,
    protein: ingredient.protein != null ? ingredient.protein * scale : undefined,
    carbs: ingredient.carbs != null ? ingredient.carbs * scale : undefined,
    fats: ingredient.fats != null ? ingredient.fats * scale : undefined,
  };
}

// The whole meal re-based to `servings` (totals, price range, every
// ingredient), with serving_size set to it. Used for saved-meal snapshots,
// which are stored at the servings the user picked.
export function scaleMeal(meal: MealType, servings: number): MealType {
  const scale = servings / (meal.serving_size ?? 1);
  if (scale === 1) return meal;
  return {
    ...meal,
    serving_size: servings,
    calories: Math.round(meal.calories * scale),
    protein: Number((meal.protein * scale).toFixed(1)),
    carbs: Number((meal.carbs * scale).toFixed(1)),
    fats: Number((meal.fats * scale).toFixed(1)),
    price: (Number(meal.price) * scale).toFixed(2),
    buffer_price: meal.buffer_price ? Number((meal.buffer_price * scale).toFixed(2)) : meal.buffer_price,
    ingredients: meal.ingredients?.map((ingredient) => scaleIngredient(ingredient, scale)),
  };
}
