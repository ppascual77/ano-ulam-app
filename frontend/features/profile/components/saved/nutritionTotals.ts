import { colors } from "@/frontend/constants/theme";
import type { SavedMeal } from "@/frontend/core/saved/types";

export type MacroKey = "protein" | "carbs" | "fats";

// Display order everywhere in the summary (card bar, sheet leaders),
// matching MacroSection's legend: protein, fat, carbs.
export const MACROS: { key: MacroKey; label: string; color: string; textClassName: string }[] = [
  { key: "protein", label: "Protein", color: colors.macro.protein, textClassName: "text-macro-protein" },
  { key: "fats", label: "Fat", color: colors.macro.fats, textClassName: "text-macro-fats" },
  { key: "carbs", label: "Carbs", color: colors.macro.carbs, textClassName: "text-macro-carbs" },
];

const KCAL_PER_GRAM: Record<MacroKey, number> = { protein: 4, carbs: 4, fats: 9 };

export const round1 = (n: number) => Math.round(n * 10) / 10;

export type NutritionTotals = { calories: number } & Record<MacroKey, number>;

// Every saved meal added up, at the servings it was saved with. (The web
// also adds rice servings; saved meals here don't carry rice yet.)
export function sumSaved(saved: SavedMeal[]): NutritionTotals {
  return saved.reduce(
    (sum, meal) => ({
      calories: sum.calories + meal.calories,
      protein: sum.protein + meal.protein,
      carbs: sum.carbs + meal.carbs,
      fats: sum.fats + meal.fats,
    }),
    { calories: 0, protein: 0, carbs: 0, fats: 0 },
  );
}

// Each macro's share of the calories that come from macros, as whole
// percents (same math as MacroLegend: grams → kcal → % of total).
export function macroSplit(totals: NutritionTotals): Record<MacroKey, number> {
  const kcal = (key: MacroKey) => totals[key] * KCAL_PER_GRAM[key];
  const total = kcal("protein") + kcal("carbs") + kcal("fats");
  const pct = (key: MacroKey) => (total ? Math.round((kcal(key) / total) * 100) : 0);
  return { protein: pct("protein"), carbs: pct("carbs"), fats: pct("fats") };
}

// The saved meal with the most of `key`, or null when none has any.
export function leaderFor(saved: SavedMeal[], key: MacroKey): SavedMeal | null {
  const best = saved.reduce<SavedMeal | null>((top, meal) => (!top || meal[key] > top[key] ? meal : top), null);
  return best && best[key] > 0 ? best : null;
}
