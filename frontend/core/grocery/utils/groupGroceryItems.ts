import { pantryHas } from "@/frontend/core/pantry/hooks/usePantry";
import type { PantryIngredient } from "@/frontend/core/pantry/types";
import type { GroceryItem } from "./buildGroceryList";

// A list item's tick on this grocery list: ticked at today's quantity,
// ticked at an older one ("stale": a meal was added since, so there's more
// to buy), or never ticked.
export type GroceryCheckState = "checked" | "stale" | "none";

// Water is in many recipes but isn't bought or kept.
const WATER = /^water\b/i;

/** Whether the pantry has this item: by catalog id, else by name. */
export function inPantry(pantry: PantryIngredient[], item: GroceryItem): boolean {
  if (item.ingredientId && pantry.some((p) => p.id === item.ingredientId)) return true;
  return pantryHas(pantry, item.canonicalName);
}

export type GroceryGroups = {
  /** Still to pick up: never ticked and not at home, or ticked at an older
   *  quantity (restock). */
  toBuy: GroceryItem[];
  /** Ticked on this list: bought (and so in the pantry). */
  gotIt: GroceryItem[];
  /** Already at home (in the pantry, not ticked here): not bought, not
   *  counted in the total. */
  atHome: GroceryItem[];
  /** ₱ of what this list buys: To buy plus Got it. */
  total: number;
  /** What the meals use of those (whole packs leave some over). */
  used: number;
};

// The one rule the whole list follows: the pantry says what's at home, a
// tick says what was bought on this trip. Ticking adds to the pantry and
// unticking takes out (see FullGroceryListSheet), so the two never disagree.
export function groupGroceryItems(
  items: GroceryItem[],
  pantry: PantryIngredient[],
  stateOf: (item: GroceryItem) => GroceryCheckState,
): GroceryGroups {
  const groups: GroceryGroups = { toBuy: [], gotIt: [], atHome: [], total: 0, used: 0 };
  for (const item of items) {
    if (WATER.test(item.canonicalName)) continue;
    const state = stateOf(item);
    if (state === "checked") groups.gotIt.push(item);
    else if (state === "none" && inPantry(pantry, item)) groups.atHome.push(item);
    else groups.toBuy.push(item);
  }
  for (const item of [...groups.toBuy, ...groups.gotIt]) {
    groups.total += item.price;
    groups.used += item.usedPrice;
  }
  return groups;
}
