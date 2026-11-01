import type { NutritionGoals } from "@/api/auth";

// How one serving of a meal sits against the daily goals, treating a meal as
// a third of the day (three meals a day, as the planner plans). Shared by
// the "Fits your goals" tag and "Best for my goals" sorting.

type MealNutrition = { calories: number; protein: number; serving_size?: number | null };

const MEALS_A_DAY = 3;
// Calories within this share of a meal's third count as a fit.
const CALORIE_BAND = 0.2;
// Protein at or above this share of a meal's third counts as a fit.
const PROTEIN_FLOOR = 0.85;

function perServing(meal: MealNutrition) {
  const servings = meal.serving_size && meal.serving_size > 0 ? meal.serving_size : 1;
  return { calories: meal.calories / servings, protein: meal.protein / servings };
}

/** How far a serving is from a meal's share of the goals: 0 is spot on,
 *  lower is better. null without a calorie or protein goal. */
export function goalDistance(meal: MealNutrition, goals: NutritionGoals): number | null {
  if (!goals.calories && !goals.protein) return null;
  const one = perServing(meal);
  let distance = 0;
  if (goals.calories) {
    const target = goals.calories / MEALS_A_DAY;
    distance += Math.abs(one.calories - target) / target;
  }
  if (goals.protein) {
    const target = goals.protein / MEALS_A_DAY;
    distance += Math.max(0, target - one.protein) / target;
  }
  return distance;
}

/** Whether a serving fits a meal's share of the goals: calories within 20%
 *  of a third of the daily goal, and protein at least 85% of a third. */
export function fitsGoals(meal: MealNutrition, goals: NutritionGoals): boolean {
  if (!goals.calories && !goals.protein) return false;
  const one = perServing(meal);
  if (!one.calories) return false;
  if (goals.calories && Math.abs(one.calories - goals.calories / MEALS_A_DAY) > (goals.calories / MEALS_A_DAY) * CALORIE_BAND) return false;
  if (goals.protein && one.protein < (goals.protein / MEALS_A_DAY) * PROTEIN_FLOOR) return false;
  return true;
}
