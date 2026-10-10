import { formatCount } from "@/frontend/core/meals/utils/multiplyQty";
import type { IngredientType, MealType, PriceSourceType } from "@/frontend/core/meals/mealTypes";

// Whole packs to buy of a packaged item ("2 × 385 ml"), from its cheapest
// supermarket listing for the amount the meals need.
export type GroceryPack = { count: number; size: string; price: number };

export type GroceryItem = {
  /** Lowercased name: the merge key, and what checkbox state is stored by. */
  id: string;
  name: string;
  qty: string;
  /** ₱ to spend on it: whole packs for a packaged item (you can't buy a
   *  teaspoon of soy sauce), the exact amount for one bought loose. */
  price: number;
  /** Packaged items with a supermarket listing: what to pick up. `qty` is
   *  then what the meals use from it ("for 2 tbsp"). */
  pack?: GroceryPack;
  /** A packaged item with no store listing: `price` is the AI-estimated
   *  typical pack's, or just the amount the meals use when it has none, so
   *  it's an estimate of the spend ("~"). */
  estimate?: boolean;
  category: "main" | "pantry";
  /** How many of the meals use it (the list's "N meals" tag when > 1). */
  meals: number;
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

// Bought loose at the market (wet market, produce, meat counter): you ask
// for the exact amount, so it stays exact. Everything else (condiments,
// oils, spices, canned goods, dairy, noodles…) comes in packs. Compared
// lowercased: the table has "Root Vegetable" and "Root vegetable".
const LOOSE_CATEGORIES = new Set([
  "pork", "beef", "poultry", "meat",
  "fish", "shellfish", "mollusk", "seafood",
  "vegetable", "fruit", "leafy green", "leafy vegetable", "root vegetable", "gourd", "tomato", "mushroom", "leaf", "citrus fruit",
  "aromatics", "allium", "herb", "herbs",
  "egg", "eggs", "rice",
]);

export const isLoose = (category: string | null | undefined) => !!category && LOOSE_CATEGORIES.has(category.trim().toLowerCase());

// A listing's pack size in its own price unit (kg or L). Its per-unit price
// is pack price / that size, so the size is pack price / per-unit price:
// works whatever units the two are in. Converting units directly can't: a
// liquid sold by the litre ("Soy sauce, 1 L") is priced per kg (via its
// density), and comparing L to kg threw those listings away.
function packSizeInUnit(source: PriceSourceType): number | null {
  if (source.packPrice <= 0 || source.pricePerUnit <= 0) return null;
  return source.packPrice / source.pricePerUnit;
}

const packLabel = (source: PriceSourceType) =>
  `${source.packSize} ${source.packUnit === "piece" ? "pc" : source.packUnit}`;

// The cheapest way to cover what the meals use with whole packs. How much
// they use comes from the price they were already given: that was the
// amount used x the ingredient's cheapest per-kg/L price (its stored
// estimated price), so amount = price / that per-unit price. Saves
// converting "2 tbsp" to ml to bottles.
const storeListings = (ingredient: IngredientType) =>
  (ingredient.priceSources ?? []).filter((s) => s.pricePerUnit > 0 && s.packPrice > 0);

function wholePacks(usedPrice: number, ingredient: IngredientType): GroceryPack | null {
  const listings = storeListings(ingredient);
  if (listings.length === 0) return estimatedPacks(usedPrice, ingredient);
  const perUnit = Math.min(
    ...listings.map((s) => s.pricePerUnit),
    ...(ingredient.daPriceSources ?? []).map((d) => d.pricePerUnit).filter((p) => p > 0),
  );
  if (!Number.isFinite(perUnit) || usedPrice <= 0) return null;
  const needed = usedPrice / perUnit;
  let best: GroceryPack | null = null;
  for (const listing of listings) {
    const size = packSizeInUnit(listing);
    if (!size) continue;
    // Tiny tolerance so an exact fit (500 ml in a 500 ml bottle) is one pack.
    const count = Math.max(1, Math.ceil(needed / size - 1e-6));
    const price = count * listing.packPrice;
    if (!best || price < best.price) best = { count, size: packLabel(listing), price };
  }
  return best;
}

// No store listing: whole packs of the AI-estimated typical pack, priced
// from the ingredient's own price, so the list shows it as an estimate.
function estimatedPacks(usedPrice: number, ingredient: IngredientType): GroceryPack | null {
  const estimate = ingredient.packEstimate;
  if (!estimate || estimate.sizeInUnit <= 0 || estimate.price <= 0 || usedPrice <= 0) return null;
  const needed = usedPrice / (estimate.price / estimate.sizeInUnit);
  const count = Math.max(1, Math.ceil(needed / estimate.sizeInUnit - 1e-6));
  return { count, size: estimate.size, price: count * estimate.price };
}

const sentenceCase = (name: string) => name.charAt(0).toUpperCase() + name.slice(1).toLowerCase();

// Every ingredient of every home-cooked meal given (fast food is left out),
// merged by name: quantities added up per unit, prices summed, and "main"
// if any meal uses it as a main ingredient. Meals must already be scaled to
// the servings being cooked (saved meals are; the Meal Planner scales them).
// Used by Profile's Grocery tab (saved meals) and the Meal Planner's plan.
export function buildGroceryList(meals: Pick<MealType, "category" | "ingredients">[]): GroceryItem[] {
  const groups = new Map<
    string,
    { name: string; parts: QtyPart[]; price: number; main: boolean; meals: Set<number>; ingredient: IngredientType }
  >();
  meals.forEach((meal, mealIndex) => {
    if (meal.category === "fast_food") return;
    for (const ingredient of meal.ingredients ?? []) {
      const id = ingredient.name.trim().toLowerCase();
      if (!id) continue;
      const group = groups.get(id) ?? {
        name: sentenceCase(ingredient.name.trim()),
        parts: [],
        price: 0,
        main: false,
        meals: new Set<number>(),
        // Same ingredient across meals: its category and listings are shared.
        ingredient,
      };
      group.meals.add(mealIndex);
      group.parts.push(parseQty(ingredient));
      group.price += ingredient.price ?? 0;
      group.main ||= ingredient.type === "main";
      groups.set(id, group);
    }
  });
  return [...groups.entries()]
    .map(([id, group]): GroceryItem => {
      const usedPrice = Math.round(group.price * 100) / 100;
      const loose = isLoose(group.ingredient.category);
      const pack = loose ? null : wholePacks(usedPrice, group.ingredient);
      // An estimate unless real listings sized the packs: no pack at all
      // (the used amount) or the AI's typical pack.
      const estimate = !loose && usedPrice > 0 && (!pack || storeListings(group.ingredient).length === 0);
      return {
        id,
        name: group.name,
        qty: formatParts(group.parts),
        price: pack ? pack.price : usedPrice,
        ...(pack ? { pack } : {}),
        ...(estimate ? { estimate: true } : {}),
        category: group.main ? "main" : "pantry",
        meals: group.meals.size,
      };
    })
    // Main ingredients first, then by name.
    .sort((a, b) => (a.category === b.category ? a.name.localeCompare(b.name) : a.category === "main" ? -1 : 1));
}
