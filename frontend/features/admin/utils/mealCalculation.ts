import type { IngredientRow } from "@/api/ingredients";
import {
  calculationProblems,
  computeItemTotals,
  convertQuantityToBasis,
  type CalcProblem,
  type ProposedTotals,
  type QuantityUnit,
} from "@/api/meals";
import type { PendingMealIngredient } from "../components/SeedMealIngredientsEditor";

// Free-text phrasing that genuinely means "no fixed quantity," as opposed
// to a blank quantity that's really just missing data.
const NO_FIXED_QUANTITY_PATTERN = /\b(to taste|as needed|as desired|optional|a pinch|pinch of|dash of|drizzle of|for garnish)\b/i;

export type CalcRow = {
  key: string;
  name: string;
  displayText: string;
  ingredient: IngredientRow | null;
  // "to taste" rows count for nothing, same as recomputeMealTotals.
  notCounted: boolean;
  // The recipe's own quantity, as entered.
  quantity: { amount: number; unit: QuantityUnit } | null;
  // The quantity the math actually used, e.g. 480 g, when it resolved.
  used: { amount: number; unit: "g" | "ml" } | null;
  computed: ProposedTotals | null;
  problems: CalcProblem[];
};

export type MealCalculation = {
  rows: CalcRow[];
  totals: { calories: number; price: number };
  errorCount: number;
  warningCount: number;
};

// The Seed Meal calculation check: how every linked ingredient turns into
// kcal and ₱, and what's definitely broken about it. Pure, so the Verify
// panel (display) and SeedMealScreen (the Save gate) read the same result.
export function buildMealCalculation(items: PendingMealIngredient[], allIngredients: IngredientRow[]): MealCalculation {
  const rows: CalcRow[] = items.map((item) => {
    const base = { key: item.key, name: item.name, displayText: item.displayText.trim() || item.name };
    const ingredient = allIngredients.find((i) => i.id === item.ingredientId) ?? null;
    const fail = (message: string): CalcRow => ({
      ...base,
      ingredient,
      notCounted: false,
      quantity: null,
      used: null,
      computed: null,
      problems: [{ level: "error", message }],
    });

    // A freshly created or relinked ingredient can be missing from the
    // cached list for one render until its query refetches.
    if (!ingredient) return fail("Still syncing after linking. Try again in a moment.");

    if (item.quantityAmount.trim() === "") {
      if (NO_FIXED_QUANTITY_PATTERN.test(item.displayText)) {
        return { ...base, ingredient, notCounted: true, quantity: null, used: null, computed: null, problems: [] };
      }
      // A blank quantity without "to taste"-style text means the amount
      // never got captured (caught live on a bell pepper whose ₱24 vanished).
      return fail(`No quantity set for "${item.displayText || "this"}", so it adds nothing. Set one, or write "to taste".`);
    }
    const amount = Number(item.quantityAmount);
    if (Number.isNaN(amount)) return fail("Quantity isn't a valid number.");

    const conversion = convertQuantityToBasis(amount, item.quantityUnit, ingredient);
    if (!conversion.ok) return fail(`${conversion.reason}, so it can't be counted.`);

    const priceAmount = item.priceQuantityAmount.trim() !== "" ? Number(item.priceQuantityAmount) : null;
    const computed = computeItemTotals(
      ingredient,
      amount,
      item.quantityUnit,
      priceAmount != null && !Number.isNaN(priceAmount) ? priceAmount : null,
      item.priceQuantityUnit || null,
    );
    return {
      ...base,
      ingredient,
      notCounted: false,
      quantity: { amount, unit: item.quantityUnit },
      used: { amount: conversion.basisAmount, unit: conversion.basisUnit === "ml" ? "ml" : "g" },
      computed,
      problems: calculationProblems(ingredient, item.quantityUnit, computed),
    };
  });

  const problems = rows.flatMap((r) => r.problems);
  return {
    rows,
    totals: {
      calories: rows.reduce((sum, r) => sum + (r.computed?.calories ?? 0), 0),
      price: rows.reduce((sum, r) => sum + (r.computed?.price ?? 0), 0),
    },
    errorCount: problems.filter((p) => p.level === "error").length,
    warningCount: problems.filter((p) => p.level === "warning").length,
  };
}
