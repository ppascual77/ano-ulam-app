import type { NutritionGoals } from "@/api/auth";
import { useIsPro } from "@/frontend/core/pro/store/useProStore";
import { usePreferences } from "./usePreferences";

/** Pro's daily nutrition goals (Settings), or null when not Pro or none is
 *  set. */
export function useNutritionGoals(): NutritionGoals | null {
  const isPro = useIsPro();
  const goals = usePreferences().prefs.nutrition_goals;
  if (!isPro) return null;
  return Object.values(goals).some((v) => v != null) ? goals : null;
}
