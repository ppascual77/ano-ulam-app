import { MACRO_PILLS_CONFIG, MACRO_RULES, NON_MACRO_RULES, NON_NUTRITION_PILLS_CONFIG } from "@/frontend/core/meals/utils/constants";
import type { MealRow } from "@/api/meals";

// The meals `tags` field's controlled vocabulary for nutrition/style pills —
// exactly the keys getMealPills already renders as pill badges elsewhere in
// the app (see core/meals/utils/getMealPills.ts, QuickFilters.tsx), so
// filtering by tag lines up with what the consumer UI actually shows.
export const PILL_TAG_OPTIONS = [
  ...Object.entries(MACRO_PILLS_CONFIG).map(([id, pill]) => ({ id, label: pill.label })),
  ...Object.entries(NON_NUTRITION_PILLS_CONFIG).map(([id, pill]) => ({ id, label: pill.label })),
];

export const PILL_TAG_IDS = new Set(PILL_TAG_OPTIONS.map((o) => o.id));

// Reuses the SAME rule functions getMealPills renders with, so a meal's
// tags never drift from what its own pill badge actually shows — at most
// one macro pill + one non-macro pill, matching getMealPills' "first rule
// wins" behavior (a dish can be High Protein OR Low Carb, not both at once,
// same as how the badge itself only ever shows one of each kind).
export function computePillTags(meal: Pick<MealRow, "calories" | "protein" | "carbohydrates" | "fat" | "total_time">): string[] {
  const macroMeal = {
    calories: meal.calories ?? 0,
    protein: meal.protein ?? 0,
    carbs: meal.carbohydrates ?? 0,
    fats: meal.fat ?? 0,
    total_time: meal.total_time ?? undefined,
  };

  const tags: string[] = [];
  for (const key of Object.keys(MACRO_RULES) as (keyof typeof MACRO_RULES)[]) {
    if (MACRO_RULES[key](macroMeal)) {
      tags.push(key);
      break;
    }
  }
  for (const key of Object.keys(NON_MACRO_RULES) as (keyof typeof NON_MACRO_RULES)[]) {
    if (NON_MACRO_RULES[key](macroMeal)) {
      tags.push(key);
      break;
    }
  }
  return tags;
}
