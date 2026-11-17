import { buildGroceryList } from "@/frontend/core/grocery/utils/buildGroceryList";
import { groceryName } from "@/frontend/core/grocery/utils/groceryLabels";
import type { IngredientType } from "@/frontend/core/meals/mealTypes";
import type { PantryIngredient } from "./types";

// "Anything used up?" after cooking: which pantry items a meal used, and
// whether each one is probably gone. Checked rows come out of the pantry.

export type UsedUpMeal = { key: string; name: string; ingredients: IngredientType[] };

export type UsedUpRow = {
  /** The pantry item (catalog id and name). */
  id: string;
  name: string;
  /** Starts checked: a main ingredient the meal most likely finished. */
  checked: boolean;
  /** Why it starts unchecked, under the name. */
  note?: string;
};

export type UsedUpGroup = { title: string; rows: UsedUpRow[] };

const WATER = /^water\b/i;

// Some left: a pack bigger than what the meal used (a 1 L bottle for 2
// tbsp). Loose market buys (meat, vegetables) are bought to the amount, so
// they're used up. Same pack math as the grocery list.
function leavesSome(ingredient: IngredientType): boolean {
  const [item] = buildGroceryList([{ category: "home", ingredients: [ingredient] }]);
  return !!item?.pack && item.price - item.usedPrice >= 1;
}

/**
 * The rows, a group per meal, then the basics (oil, garlic, laurel) from
 * all of them together: those last many meals, so they start unchecked.
 * Only what's in the pantry (nothing else to take out), each item once.
 * `laterNeeds`: pantry items a later planned meal still uses, by id, with
 * that meal ("Chicken Tinola tonight"); they start unchecked too.
 */
export function buildUsedUpGroups(
  meals: UsedUpMeal[],
  pantry: PantryIngredient[],
  laterNeeds: Map<string, string>,
): UsedUpGroup[] {
  const have = new Map(pantry.map((p) => [p.id, p]));
  const seen = new Set<string>();
  const groups: UsedUpGroup[] = [];
  const basics: UsedUpRow[] = [];
  for (const meal of meals) {
    const rows: UsedUpRow[] = [];
    for (const ingredient of meal.ingredients) {
      const id = ingredient.ingredientId;
      if (!id || seen.has(id) || !have.has(id) || WATER.test(ingredient.name)) continue;
      seen.add(id);
      // What a shopper calls it ("Tomato", not "Tomato, raw").
      const name = groceryName(ingredient.name, ingredient.displayName);
      const later = laterNeeds.get(id);
      if (ingredient.type === "pantry") {
        basics.push({ id, name, checked: false, ...(later ? { note: `Still needed for ${later}` } : {}) });
        continue;
      }
      const note = later ? `Still needed for ${later}` : leavesSome(ingredient) ? "Some left in the pack" : undefined;
      rows.push({ id, name, checked: !note, ...(note ? { note } : {}) });
    }
    if (rows.length > 0) groups.push({ title: meal.name, rows });
  }
  if (basics.length > 0) groups.push({ title: "Basics · these usually last", rows: basics });
  return groups;
}
