import { useCallback, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { MealType } from "@/frontend/core/meals/mealTypes";
import { savedKeys } from "../queryKeys";
import { listSavedMeals, saveMeal, syncSavedMeal, unsaveMeal, updateSavedServings } from "../mock/api";
import { SAVED_MEALS_LIMIT, savedKeyOf, type SavedMeal } from "../types";

export const SAVED_LIMIT_MESSAGE = `You've reached the limit of ${SAVED_MEALS_LIMIT} saved meals. Remove one to add more.`;
const SAVE_FAILED_MESSAGE = "Couldn't update your saved meals. Please try again.";

// The one saved-meals list every save button reads (MealCard, Discover,
// Meal Details, Profile's Saved tab), so a save anywhere shows everywhere.
export function useSavedMeals() {
  return useQuery({ queryKey: savedKeys.list, queryFn: listSavedMeals, staleTime: Infinity });
}

// Lookup + actions on the shared list. Save/unsave are optimistic (the
// bookmark flips right away) and revert on failure. Each action resolves to
// an error message for the caller to toast, or null.
export function useSavedMealActions() {
  const queryClient = useQueryClient();
  const { data: saved = [] } = useSavedMeals();

  const byKey = useMemo(() => new Map(saved.map((entry) => [entry.meal_catalog_id, entry])), [saved]);
  const savedFor = useCallback((meal: MealType | null | undefined) => (meal ? byKey.get(savedKeyOf(meal)) : undefined), [byKey]);

  const read = () => queryClient.getQueryData<SavedMeal[]>(savedKeys.list) ?? [];
  const write = (next: SavedMeal[]) => queryClient.setQueryData(savedKeys.list, next);

  const save = async (meal: MealType, servings?: number): Promise<string | null> => {
    const before = read();
    const key = savedKeyOf(meal);
    if (before.some((entry) => entry.meal_catalog_id === key)) return null;
    if (before.length >= SAVED_MEALS_LIMIT) return SAVED_LIMIT_MESSAGE;
    // Placeholder entry until the real one comes back.
    const optimistic: SavedMeal = {
      ...meal,
      saved_id: `pending-${key}`,
      meal_catalog_id: key,
      date_saved: new Date().toISOString(),
      serving_size: servings ?? meal.serving_size ?? 1,
      catalog_status: "active",
    };
    write([optimistic, ...before]);
    try {
      const entry = await saveMeal(meal, servings);
      write(read().map((e) => (e.meal_catalog_id === key ? entry : e)));
      return null;
    } catch (error) {
      write(read().filter((e) => e.meal_catalog_id !== key));
      return error instanceof Error && error.message === "limit" ? SAVED_LIMIT_MESSAGE : SAVE_FAILED_MESSAGE;
    }
  };

  const unsave = async (entry: SavedMeal): Promise<string | null> => {
    const before = read();
    write(before.filter((e) => e.saved_id !== entry.saved_id));
    try {
      await unsaveMeal(entry.saved_id);
      return null;
    } catch {
      write(before);
      return SAVE_FAILED_MESSAGE;
    }
  };

  // Save or unsave, whichever applies.
  const toggle = (meal: MealType) => {
    const entry = savedFor(meal);
    return entry ? unsave(entry) : save(meal);
  };

  // Not optimistic: the caller shows "Updating…" / "Syncing…" meanwhile.
  const updateServings = async (entry: SavedMeal, meal: MealType, servings: number): Promise<string | null> => {
    try {
      const updated = await updateSavedServings(entry.saved_id, meal, servings);
      write(read().map((e) => (e.saved_id === entry.saved_id ? updated : e)));
      return null;
    } catch {
      return "Couldn't update the servings. Please try again.";
    }
  };

  const sync = async (entry: SavedMeal): Promise<string | null> => {
    try {
      const synced = await syncSavedMeal(entry.saved_id);
      write(read().map((e) => (e.saved_id === entry.saved_id ? synced : e)));
      return null;
    } catch {
      return "Couldn't sync this meal. Please try again.";
    }
  };

  return { saved, savedFor, save, unsave, toggle, updateServings, sync };
}
