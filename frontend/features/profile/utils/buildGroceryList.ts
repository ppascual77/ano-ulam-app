import { formatCount } from "@/frontend/core/meals/utils/multiplyQty";
import type { IngredientType } from "@/frontend/core/meals/mealTypes";
import type { SavedMeal } from "@/frontend/core/saved/types";

export type GroceryItem = {
  /** Lowercased name: the merge key, and what checkbox state is stored by. */
  id: string;
  name: string;
  qty: string;
  /** ₱ for the combined quantity. */
  price: number;
  category: "main" | "pantry";
};

// One ingredient's quantity, in a form that can be added to another of the
// same unit. Weights go to g, volumes to ml; counts keep their label.
type QtyPart = { key: string; amount: number; unit: string } | { key: string; text: string };

const UNIT_ALIASES: Record<string, { unit: string; factor: number }> = {
  g: { unit: "g", factor: 1 },
  gram: { unit: "g", factor: 1 },
  grams: { unit: "g", factor: 1 },
  kg: { unit: "g", factor: 1000 },
  ml: { unit: "ml", factor: 1 },
  l: { unit: "ml", factor: 1000 },
};

function parseQty(ingredient: IngredientType): QtyPart {
  if (ingredient.count) {
    return { key: `count:${ingredient.count.label}`, amount: ingredient.count.amount, unit: ingredient.count.label };
  }
  // "500 g", "1.5 kg", "2 cups, chopped": a number, then a unit word. Any
  // prep notes after it are dropped (they don't matter at the store).
  const match = ingredient.qty.trim().match(/^(\d+(?:\.\d+)?)\s*([a-zA-Z]+)?/);
  if (!match) return { key: `text:${ingredient.qty}`, text: ingredient.qty };
  const amount = parseFloat(match[1]);
  const rawUnit = (match[2] ?? "").toLowerCase();
  const alias = UNIT_ALIASES[rawUnit];
  if (alias) return { key: `unit:${alias.unit}`, amount: amount * alias.factor, unit: alias.unit };
  return { key: `unit:${rawUnit}`, amount, unit: match[2] ?? "" };
}

const round = (n: number) => (Number.isInteger(n) ? n : Math.round(n * 10) / 10);

function formatParts(parts: QtyPart[]): string {
  const totals = new Map<string, QtyPart>();
  for (const part of parts) {
    const existing = totals.get(part.key);
    if (existing && "amount" in existing && "amount" in part) {
      totals.set(part.key, { ...existing, amount: existing.amount + part.amount });
    } else if (!existing) {
      totals.set(part.key, part);
    }
  }
  // "to taste" next to a real amount adds nothing at the store.
  const values = [...totals.values()];
  const hasAmount = values.some((part) => "amount" in part);
  return values
    .filter((part) => !hasAmount || "amount" in part)
    .map((part) => {
      if ("text" in part) return part.text;
      if (part.key.startsWith("count:")) return formatCount(part.amount, part.unit);
      return part.unit ? `${round(part.amount)} ${part.unit}` : `${round(part.amount)}`;
    })
    .join(" + ");
}

const sentenceCase = (name: string) => name.charAt(0).toUpperCase() + name.slice(1).toLowerCase();

// Every ingredient of every saved home-cooked meal (fast food is left out),
// merged by name: quantities added up per unit, prices summed, and "main"
// if any meal uses it as a main ingredient. Saved meals are snapshots at
// the user's servings, so quantities are already scaled.
export function buildGroceryList(saved: SavedMeal[]): GroceryItem[] {
  const groups = new Map<string, { name: string; parts: QtyPart[]; price: number; main: boolean }>();
  for (const meal of saved) {
    if (meal.category === "fast_food") continue;
    for (const ingredient of meal.ingredients ?? []) {
      const id = ingredient.name.trim().toLowerCase();
      if (!id) continue;
      const group = groups.get(id) ?? { name: sentenceCase(ingredient.name.trim()), parts: [], price: 0, main: false };
      group.parts.push(parseQty(ingredient));
      group.price += ingredient.price ?? 0;
      group.main ||= ingredient.type === "main";
      groups.set(id, group);
    }
  }
  return [...groups.entries()]
    .map(([id, group]) => ({
      id,
      name: group.name,
      qty: formatParts(group.parts),
      price: Math.round(group.price * 100) / 100,
      category: group.main ? ("main" as const) : ("pantry" as const),
    }))
    // Main ingredients first, then by name.
    .sort((a, b) => (a.category === b.category ? a.name.localeCompare(b.name) : a.category === "main" ? -1 : 1));
}
