import { getMeal, getMeals } from "@/api/meals";
import { mealRowToMealType } from "@/frontend/core/meals/utils/mealAdapter";
import { scaleMeal } from "@/frontend/core/meals/utils/scaleMeal";
import type { MealType } from "@/frontend/core/meals/mealTypes";
import { SAVED_MEALS_LIMIT, savedKeyOf, type CatalogStatus, type SavedMeal } from "../types";

// MOCK — the saved-meals list, with the spec'd function names
// (listSavedMeals, saveMeal, ...) so wiring a real table later is a swap of
// these bodies. Lives in memory and resets on reload. The meals themselves
// are real: a save snapshots the real catalog meal (with its ingredients).

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// TEMP (dev only): start with a few saved meals, one per catalog_status, so
// the Saved tab's strips and the "updated" prompt are visible without
// setting them up by hand. Remove with the mock.
const DEV_SEED = __DEV__;
const SEED_STATUSES: CatalogStatus[] = ["active", "updated", "pending", "deleted"];

let saved: SavedMeal[] = [];
let seeded = false;
let nextId = 1;

// Bulk-listed meals come without ingredients; a snapshot should have them
// (Meal Details opened from Saved shows the saved copy).
async function withIngredients(meal: MealType): Promise<MealType> {
  if (meal.ingredients?.length || !meal.id) return meal;
  try {
    const row = await getMeal(meal.id);
    return mealRowToMealType(row, row.meal_ingredients);
  } catch {
    return meal;
  }
}

function snapshot(meal: MealType, servings: number, status: CatalogStatus = "active"): SavedMeal {
  const scaled = scaleMeal(meal, servings);
  return {
    ...scaled,
    saved_id: `saved-${nextId++}`,
    meal_catalog_id: savedKeyOf(meal),
    date_saved: new Date().toISOString(),
    serving_size: servings,
    catalog_status: status,
  };
}

async function seed() {
  if (seeded) return;
  seeded = true;
  if (!DEV_SEED) return;
  try {
    const rows = await getMeals();
    const picks = rows.slice(0, SEED_STATUSES.length);
    const meals = await Promise.all(picks.map((row) => withIngredients(mealRowToMealType(row))));
    saved = meals.map((meal, i) => snapshot(meal, meal.serving_size ?? 1, SEED_STATUSES[i]));
  } catch {
    // No seed if the catalog can't load; the list just starts empty.
  }
}

// Most recent first.
export async function listSavedMeals(): Promise<SavedMeal[]> {
  await seed();
  await delay(300);
  return [...saved];
}

// Throws Error("limit") at SAVED_MEALS_LIMIT. Saving an already-saved meal
// returns the existing entry.
export async function saveMeal(meal: MealType, servings?: number): Promise<SavedMeal> {
  await seed();
  const existing = saved.find((s) => s.meal_catalog_id === savedKeyOf(meal));
  if (existing) return existing;
  if (saved.length >= SAVED_MEALS_LIMIT) throw new Error("limit");
  const full = await withIngredients(meal);
  const entry = snapshot(full, servings ?? full.serving_size ?? 1);
  saved = [entry, ...saved];
  return entry;
}

export async function unsaveMeal(savedId: string): Promise<void> {
  await delay(400);
  saved = saved.filter((s) => s.saved_id !== savedId);
}

// Re-bases the snapshot to `servings` (the caller's meal is the snapshot
// as shown, so scaling it from its own serving_size is exact).
export async function updateSavedServings(savedId: string, meal: MealType, servings: number): Promise<SavedMeal> {
  await delay(600);
  const current = saved.find((s) => s.saved_id === savedId);
  if (!current) throw new Error("Saved meal not found");
  const updated: SavedMeal = { ...current, ...scaleMeal(meal, servings), serving_size: servings };
  saved = saved.map((s) => (s.saved_id === savedId ? updated : s));
  return updated;
}

// "Sync latest version": re-snapshot from the live catalog meal at the
// same servings, and clear the status.
export async function syncSavedMeal(savedId: string): Promise<SavedMeal> {
  await delay(600);
  const current = saved.find((s) => s.saved_id === savedId);
  if (!current) throw new Error("Saved meal not found");
  let latest: MealType = current;
  if (current.id) {
    const row = await getMeal(current.id);
    latest = mealRowToMealType(row, row.meal_ingredients);
  }
  const synced: SavedMeal = {
    ...current,
    ...scaleMeal(latest, current.serving_size),
    serving_size: current.serving_size,
    catalog_status: "active",
  };
  saved = saved.map((s) => (s.saved_id === savedId ? synced : s));
  return synced;
}
