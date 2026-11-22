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
  fastfood: "Fast food",
};

/** In a sentence ("No breakfast fits ₱300 yet"). */
export const CATEGORY_NOUNS: Record<CategoryId, string> = {
  breakfast: "breakfast",
  lunch: "lunch",
  dinner: "dinner",
  fastfood: "fast food",
};

/**
 * How well a meal suits Lunch or Dinner, for ordering those tiles. Most ulam
 * are tagged both (that's how they're eaten), so the two tiles hold the same
 * meals; this only decides which come first, so the first screen of each
 * reads different. Lunch leans quick, fried and grilled (weekday lunch,
 * baon); Dinner leans sabaw, stews and long cooks for the family table. A
 * meal tagged only one of the two leads its own tile. 0 for any other
 * category (no reordering).
 */
export function mealTimeFit(meal: MealType, category: CategoryId | null): number {
  if (category !== "lunch" && category !== "dinner") return 0;
  const tags = meal.tags ?? [];
  const times = mealTimesOf(tags);
  const minutes = meal.total_time ?? 0;
  const soupy = tags.includes("soupy");
  let fit = 0;
  if (category === "lunch") {
    if (!times.includes("dinner")) fit += 3;
    if (minutes > 0 && minutes <= 30) fit += 2;
    else if (minutes > 0 && minutes <= 45) fit += 1;
    if (tags.includes("quick")) fit += 1;
    if (tags.includes("fried") || tags.includes("grilled")) fit += 1;
    if (soupy) fit -= 1;
  } else {
    if (!times.includes("lunch")) fit += 3;
    if (soupy) fit += 2;
    if (minutes >= 60) fit += 1;
    if (tags.includes("filling")) fit += 1;
  }
  return fit;
}

/** Whether a meal belongs to the picked category (null: all do). */
export function inCategory(meal: MealType, category: CategoryId | null): boolean {
  if (!category) return true;
  if (category === "fastfood") return meal.category === "fast_food";
  return mealTimesOf(meal.tags).includes(category);
}
