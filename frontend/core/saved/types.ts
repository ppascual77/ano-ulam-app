import type { MealType } from "@/frontend/core/meals/mealTypes";

// What happened to the original recipe since it was saved (shown as a strip
// on the saved card). null/active = nothing.
export type CatalogStatus = "active" | "pending" | "updated" | "deleted" | null;

// A saved meal is a snapshot of the meal at save time, scaled to the
// servings the user picked (so serving_size = their servings). Unlike the
// web's type, `id` stays the catalog id (every like/save/details path in
// this app keys on meal.id) and the saved-record id is `saved_id`.
export type SavedMeal = MealType & {
  saved_id: string;
  /** Catalog id, or normalized name for meals without one. See savedKeyOf. */
  meal_catalog_id: string;
  date_saved: string;
  serving_size: number;
  catalog_status: CatalogStatus;
};

// Free accounts keep up to SAVED_MEALS_LIMIT saves; Pro is unlimited
// (PRO_SAVED_MEALS_LIMIT is only a technical cap, shown as "Unlimited").
// The saved_meals_limit trigger in the database matches.
export const SAVED_MEALS_LIMIT = 10;
export const PRO_SAVED_MEALS_LIMIT = 500;
export const savedMealsLimit = (isPro: boolean) => (isPro ? PRO_SAVED_MEALS_LIMIT : SAVED_MEALS_LIMIT);

export function savedKeyOf(meal: MealType): string {
  return meal.id ?? meal.normalized_name ?? meal.name;
}
