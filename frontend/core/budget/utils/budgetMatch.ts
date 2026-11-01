import type { MealType } from "@/frontend/core/meals/mealTypes";
import { scaleMeal } from "@/frontend/core/meals/utils/scaleMeal";

// Suggest by Budget: which real meals fit "₱X for N servings".
//
// A meal's stored price (like its macros) is for the whole recipe, its
// serving_size; the cost for N servings is that per serving times N. The
// full price counts, the same number the meal card shows, so a meal that
// fits really costs about that. Fits within BUDGET_RANGE either side of the
// budget (₱300 -> ₱270 to ₱330), closest to the budget first. Meals with
// any of the user's allergens are always left out.

export const BUDGET_RANGE = 0.1;

export type BudgetMatch = {
  /** The meal re-based to the chosen servings (price, macros, ingredients),
   *  so its card and detail sheet show what they'd actually cook. */
  meal: MealType;
  /** Per serving, for the macro-based filter chips. */
  perServing: MealType;
  /** For the chosen servings. */
  cost: number;
  /** cost - budget: negative is under, positive is over. */
  diff: number;
};

/** "1,500" or "₱300" -> 1500 / 300; null for anything that isn't a positive amount. */
export function parseBudget(text: string): number | null {
  const amount = Number(text.replace(/[^0-9.]/g, ""));
  return Number.isFinite(amount) && amount > 0 ? amount : null;
}

function hasAllergen(meal: MealType, allergens: string[]) {
  const avoid = allergens.filter((a) => a !== "none").map((a) => a.toLowerCase());
  if (avoid.length === 0) return false;
  return (meal.allergens ?? []).some((a) => avoid.includes(a.toLowerCase()));
}

export function matchBudget(meals: MealType[], budget: number, servings: number, allergens: string[]): BudgetMatch[] {
  const low = budget * (1 - BUDGET_RANGE);
  const high = budget * (1 + BUDGET_RANGE);
  return meals
    .flatMap((meal) => {
      const price = Number(meal.price);
      if (!Number.isFinite(price) || price <= 0 || hasAllergen(meal, allergens)) return [];
      const cost = (price / (meal.serving_size || 1)) * servings;
      if (cost < low || cost > high) return [];
      return [{ meal: scaleMeal(meal, servings), perServing: scaleMeal(meal, 1), cost, diff: cost - budget }];
    })
    .sort((a, b) => Math.abs(a.diff) - Math.abs(b.diff));
}

// Dietary focus (users.preferences), as a filter: which meal dietary_tags
// satisfy it. Stricter diets count for looser ones (a vegan meal is
// vegetarian; vegetarian and vegan are pescatarian).
const SATISFIES: Record<string, string[]> = {
  vegetarian: ["vegetarian", "vegan"],
  pescatarian: ["pescatarian", "vegetarian", "vegan"],
};

/** Whether a meal fits the user's dietary focus ("none": every meal does). */
export function fitsDietaryFocus(meal: MealType, focus: string): boolean {
  if (!focus || focus === "none") return true;
  const accepted = SATISFIES[focus] ?? [focus];
  return (meal.dietary_tags ?? []).some((tag) => accepted.includes(tag.toLowerCase()));
}

/** Whether a meal fits the user's preferences: none of their allergens,
 *  and their dietary focus (see fitsDietaryFocus). */
export function fitsPreferences(meal: MealType, prefs: { allergens: string[]; dietary_focus: string }): boolean {
  return !hasAllergen(meal, prefs.allergens) && fitsDietaryFocus(meal, prefs.dietary_focus);
}
