import type { IngredientRow } from "@/api/ingredients";

// One-tap adds under the Ingredients step's search, before anything is
// typed: the aromatics and condiments most Filipino recipes start with
// (adobo alone uses most of these). Each resolves to a real ingredients-table
// row, the first catalog name listed that exists (case-insensitive), so a
// chip behaves exactly like picking that row from search. One with no match
// is left out. Same resolving as the pantry's staples (core/pantry/staples.ts).
const QUICK_ADDS: { label: string; names: string[] }[] = [
  { label: "Garlic", names: ["Garlic", "Garlic, raw"] },
  { label: "Onion", names: ["Onion, red, raw", "Onion", "Onion, white, raw"] },
  { label: "Soy sauce", names: ["Soy sauce"] },
  { label: "Vinegar", names: ["Vinegar, cane", "Vinegar, white"] },
  { label: "Cooking oil", names: ["Cooking oil"] },
  { label: "Salt", names: ["Salt"] },
  { label: "Pepper", names: ["Black pepper, ground", "Black peppercorns, whole"] },
  { label: "Ginger", names: ["Ginger, raw", "Ginger"] },
  { label: "Tomato", names: ["Tomato, raw"] },
];

export type QuickAdd = { label: string; ingredient: IngredientRow };

export function resolveQuickAdds(ingredients: IngredientRow[]): QuickAdd[] {
  const byName = new Map(ingredients.map((row) => [row.canonical_name.toLowerCase(), row]));
  const out: QuickAdd[] = [];
  for (const { label, names } of QUICK_ADDS) {
    const row = names.map((n) => byName.get(n.toLowerCase())).find(Boolean);
    if (row) out.push({ label, ingredient: row });
  }
  return out;
}

// The short everyday name for an ingredient ("Garlic, raw" -> "Garlic"),
// used for chips and for spotting it in a step's text.
export function shortName(ingredient: IngredientRow): string {
  return (ingredient.display_name ?? ingredient.canonical_name).split(",")[0].trim();
}
