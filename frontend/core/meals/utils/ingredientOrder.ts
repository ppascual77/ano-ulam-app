import type { IngredientType } from "../mealTypes";

// Mains first, then oils, then the other staples.
export function orderIngredients(ingredients: IngredientType[]) {
  const main = ingredients.filter((it) => it.type === "main");
  const oils = ingredients.filter((it) => it.type === "pantry" && /oil/i.test(it.name));
  const rest = ingredients.filter((it) => it.type === "pantry" && !/oil/i.test(it.name));
  return [...main, ...oils, ...rest];
}

// Splits a recipe into its parts ("For the sauce", "For seasoning the
// chicken"): the unlabeled main list first, then each section in the order
// the recipe first lists it. Each group keeps orderIngredients' order.
// A meal with no sections comes back as one unlabeled group, unchanged.
export function groupIngredients(ingredients: IngredientType[]) {
  const groups: { section: string | null; items: IngredientType[] }[] = [];
  for (const ingredient of ingredients) {
    const section = ingredient.section?.trim() || null;
    let group = groups.find((g) => g.section === section);
    if (!group) {
      group = { section, items: [] };
      groups.push(group);
    }
    group.items.push(ingredient);
  }
  return groups
    .sort((a, b) => Number(a.section !== null) - Number(b.section !== null))
    .map((g) => ({ section: g.section, items: orderIngredients(g.items) }));
}

// Plain water ("Water", "hot water", "tubig", ...): free and nothing to look
// up, so its row shows no price/N/A and isn't tappable. Not "coconut water".
export const PLAIN_WATER = /^((hot|cold|warm|boiling|tap|mainit na|malamig na)\s+)?(water|tubig)$/i;
