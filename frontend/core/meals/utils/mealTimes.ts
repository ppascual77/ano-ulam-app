// When a meal is eaten, stored as plain values in the meal's `tags` (next
// to the nutrition pills and cooking method). A meal can have several
// (adobo is lunch and dinner). The ids match Home's Categories tiles
// (core/budget/components/CategoriesSection.tsx) so those tiles can filter
// by them. Fastfood is a category of its own, not a meal time.
export const MEAL_TIME_OPTIONS = [
  { id: "breakfast", label: "Breakfast" },
  { id: "lunch", label: "Lunch" },
  { id: "dinner", label: "Dinner" },
] as const;

export type MealTime = (typeof MEAL_TIME_OPTIONS)[number]["id"];

export const MEAL_TIME_IDS: ReadonlySet<string> = new Set(MEAL_TIME_OPTIONS.map((o) => o.id));

export function mealTimesOf(tags: string[] | null | undefined): MealTime[] {
  return (tags ?? []).filter((t): t is MealTime => MEAL_TIME_IDS.has(t));
}

// Replaces just the meal-time values in a tags array, keeping every other tag.
export function withMealTimes(tags: string[], mealTimes: string[]): string[] {
  return [...tags.filter((t) => !MEAL_TIME_IDS.has(t)), ...mealTimes.filter((t) => MEAL_TIME_IDS.has(t))];
}
