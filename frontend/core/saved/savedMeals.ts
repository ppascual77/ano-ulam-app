import { getMeal } from "@/api/meals";
import {
  deleteSavedMeal,
  getMealStatuses,
  getSavedMealRow,
  insertSavedMeal,
  listSavedMealRows,
  updateSavedMeal,
  type MealStatusRow,
  type SavedMealRow,
} from "@/api/saved";
import type { Json } from "@/lib/database.types";
import { mealRowToMealType } from "@/frontend/core/meals/utils/mealAdapter";
import { scaleMeal } from "@/frontend/core/meals/utils/scaleMeal";
import type { MealType } from "@/frontend/core/meals/mealTypes";
import { savedKeyOf, type CatalogStatus, type SavedMeal } from "./types";

// The saved-meals list, on public.saved_meals (api/saved.ts). A save is a
// snapshot of the meal (with its ingredients) scaled to the user's servings,
// so Meal Details from Saved shows the saved copy, and the card can say
// what's happened to the original since.

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const isCatalogId = (id: string | undefined) => !!id && UUID.test(id);

// Bulk-listed meals come without ingredients; a snapshot should have them.
async function withIngredients(meal: MealType): Promise<MealType> {
  if (meal.ingredients?.length || !isCatalogId(meal.id)) return meal;
  try {
    const row = await getMeal(meal.id!);
    return mealRowToMealType(row, row.meal_ingredients);
  } catch {
    return meal;
  }
}

// What's happened to the original recipe since the snapshot was taken (or
// last synced): removed, back in review, or edited. Nothing for a meal
// that was never in the catalog.
function statusOf(row: SavedMealRow, snapshot: MealType, live: Map<string, MealStatusRow>): CatalogStatus {
  if (!row.meal_id) return isCatalogId(snapshot.id) ? "deleted" : null;
  const meal = live.get(row.meal_id);
  if (!meal || meal.archived_at) return "deleted";
  if (meal.status !== "approved") return "pending";
  if (new Date(meal.updated_at) > new Date(row.synced_at)) return "updated";
  return "active";
}

function toSaved(row: SavedMealRow, status: CatalogStatus): SavedMeal {
  const snapshot = row.meal_data as unknown as MealType;
  return {
    ...snapshot,
    saved_id: row.id,
    meal_catalog_id: row.meal_key,
    date_saved: row.saved_at,
    serving_size: row.serving_size,
    catalog_status: status,
  };
}

// Most recent first.
export async function listSavedMeals(): Promise<SavedMeal[]> {
  const rows = await listSavedMealRows();
  const ids = rows.flatMap((row) => (row.meal_id ? [row.meal_id] : []));
  const live = new Map((await getMealStatuses(ids)).map((meal) => [meal.id, meal]));
  return rows.map((row) => toSaved(row, statusOf(row, row.meal_data as unknown as MealType, live)));
}

// Throws Error("limit") at SAVED_MEALS_LIMIT. Saving an already-saved meal
// returns the existing entry.
export async function saveMeal(meal: MealType, servings?: number): Promise<SavedMeal> {
  const full = await withIngredients(meal);
  const serving = servings ?? full.serving_size ?? 1;
  const row = await insertSavedMeal({
    mealId: isCatalogId(full.id) ? full.id! : null,
    mealKey: savedKeyOf(meal),
    mealData: scaleMeal(full, serving) as unknown as Json,
    servingSize: serving,
  });
  return toSaved(row, "active");
}

export async function unsaveMeal(savedId: string): Promise<void> {
  await deleteSavedMeal(savedId);
}

// Re-bases the snapshot to `servings` (the caller's meal is the snapshot as
// shown, so scaling it from its own serving_size is exact). Not a sync:
// synced_at stays, so an "updated" original still says so.
export async function updateSavedServings(savedId: string, meal: MealType, servings: number): Promise<SavedMeal> {
  const before = await getSavedMealRow(savedId);
  const row = await updateSavedMeal(savedId, { meal_data: scaleMeal(meal, servings) as unknown as Json, serving_size: servings });
  const live = new Map((await getMealStatuses(before.meal_id ? [before.meal_id] : [])).map((m) => [m.id, m]));
  return toSaved(row, statusOf(row, row.meal_data as unknown as MealType, live));
}

// "Sync latest version": re-snapshot from the live catalog meal at the same
// servings, and clear the status.
export async function syncSavedMeal(savedId: string): Promise<SavedMeal> {
  const current = await getSavedMealRow(savedId);
  if (!current.meal_id) return toSaved(current, null);
  const live = await getMeal(current.meal_id);
  const latest = mealRowToMealType(live, live.meal_ingredients);
  const row = await updateSavedMeal(savedId, {
    meal_data: scaleMeal(latest, current.serving_size) as unknown as Json,
    synced_at: new Date().toISOString(),
  });
  return toSaved(row, "active");
}

