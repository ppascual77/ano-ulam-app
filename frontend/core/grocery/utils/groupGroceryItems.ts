import { pantryHas } from "@/frontend/core/pantry/hooks/usePantry";
import type { PantryIngredient } from "@/frontend/core/pantry/types";
import type { GroceryItem } from "./buildGroceryList";

// Water is in many recipes but isn't bought or kept.
const WATER = /^water\b/i;

/** The pantry item that covers this one: the same catalog ingredient, else
 *  one whose name is in its name ("Vinegar" covers "Coconut vinegar"). */
export function pantryMatch(pantry: PantryIngredient[], item: GroceryItem): PantryIngredient | undefined {
  return (item.ingredientId ? pantry.find((p) => p.id === item.ingredientId) : undefined) ?? pantry.find((p) => pantryHas([p], item.canonicalName));
}

/** Whether the pantry has this item (see pantryMatch). */
export function inPantry(pantry: PantryIngredient[], item: GroceryItem): boolean {
  return pantryMatch(pantry, item) != null;
}

/** For an item in the pantry under another name, that name ("Vinegar"). */
export function coveringName(pantry: PantryIngredient[], item: GroceryItem): string | undefined {
  const match = pantryMatch(pantry, item);
  if (!match || match.id === item.ingredientId) return undefined;
  return match.name.trim().toLowerCase() === item.name.trim().toLowerCase() ? undefined : match.name;
}

export type GroceryGroups = {
  /** Not in the pantry: still to pick up. */
  toBuy: GroceryItem[];
  /** "In your cart": ticked on this visit to the list (and so put in the
   *  pantry). */
  gotIt: GroceryItem[];
  /** "In your pantry": there from before this visit, not bought, not
   *  counted in the total. */
  atHome: GroceryItem[];
  /** ₱ of what this trip buys: To buy plus the cart. */
  total: number;
  /** What the meals use of those (whole packs leave some over). */
  used: number;
};

// The one rule the whole list follows: the pantry says what's at home. A
// tick puts an item in the pantry and holds it in the cart until the list
// closes; next time it's under In your pantry. Taking it out of the pantry
// (an untick, "+ To buy", Profile, the nudge) brings it back to To buy.
// `tickedNow`: item ids ticked on this visit (none outside the sheet).
export function groupGroceryItems(items: GroceryItem[], pantry: PantryIngredient[], tickedNow: ReadonlySet<string> = new Set()): GroceryGroups {
  const groups: GroceryGroups = { toBuy: [], gotIt: [], atHome: [], total: 0, used: 0 };
  for (const item of items) {
    if (WATER.test(item.canonicalName)) continue;
    // An item with no catalog id can't go in the pantry: ticked, it shows
    // in the cart for this visit only.
    if (tickedNow.has(item.id)) groups.gotIt.push(item);
    else if (inPantry(pantry, item)) groups.atHome.push(item);
    else groups.toBuy.push(item);
  }
  for (const item of [...groups.toBuy, ...groups.gotIt]) {
    groups.total += item.price;
    groups.used += item.usedPrice;
  }
  return groups;
}
