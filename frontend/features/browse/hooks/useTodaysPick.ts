import { useMemo } from "react";
import { usePreferredMeals } from "@/frontend/core/meals/hooks/usePreferredMeals";
import type { MealType } from "@/frontend/core/meals/mealTypes";

// Browse's "Today's pick": one real home-cooked meal per day (with a photo,
// when any have one), the same all day and a new one after local midnight.
// Picked by the day's number over the catalog in id order, so it doesn't
// reshuffle on every visit. Follows preferences (usePreferredMeals).
function dayNumber() {
  const now = new Date();
  return Math.floor(new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime() / 86_400_000);
}

// Whole hours until the next pick (local midnight), at least 1.
export function hoursUntilNextPick(): number {
  const now = new Date();
  const midnight = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
  return Math.max(1, Math.ceil((midnight.getTime() - now.getTime()) / 3_600_000));
}

export function useTodaysPick(): { meal: MealType | null; isLoading: boolean } {
  const { meals, isLoading } = usePreferredMeals();
  const meal = useMemo(() => {
    const homeCooked = meals.filter((m) => m.category !== "fast_food");
    const withPhoto = homeCooked.filter((m) => m.image_url);
    const pool = (withPhoto.length > 0 ? withPhoto : homeCooked).sort((a, b) => (a.id ?? "").localeCompare(b.id ?? ""));
    return pool.length > 0 ? pool[dayNumber() % pool.length] : null;
  }, [meals]);
  return { meal, isLoading };
}
