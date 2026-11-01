import type { MealType } from "@/frontend/core/meals/mealTypes";
import { mealTimesOf } from "@/frontend/core/meals/utils/mealTimes";

// Home's Categories tiles (CategoriesSection), as a filter on meals: a meal
// time keeps meals tagged with it (a meal can have several: adobo is lunch
// and dinner); Fastfood keeps fast food meals. Shared by Home's
// Recommendations and Suggest by Budget's results.

export type CategoryId = "breakfast" | "lunch" | "dinner" | "fastfood";

export const CATEGORY_LABELS: Record<CategoryId, string> = {
  breakfast: "Breakfast",
  lunch: "Lunch",
  dinner: "Dinner",
  fastfood: "Fastfood",
};

/** In a sentence ("No breakfast fits ₱300 yet"). */
export const CATEGORY_NOUNS: Record<CategoryId, string> = {
  breakfast: "breakfast",
  lunch: "lunch",
  dinner: "dinner",
  fastfood: "fast food",
};

/** Whether a meal belongs to the picked category (null: all do). */
export function inCategory(meal: MealType, category: CategoryId | null): boolean {
  if (!category) return true;
  if (category === "fastfood") return meal.category === "fast_food";
  return mealTimesOf(meal.tags).includes(category);
}
