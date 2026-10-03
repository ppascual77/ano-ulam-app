import { computeItemTotals, convertQuantityToBasis, type ProposedTotals } from "@/api/meals";
import type { DraftIngredient } from "../types";

export type LineTotals =
  | { status: "ok"; totals: ProposedTotals }
  // "to taste", or a free-text line with no ingredient data yet: counts as 0.
  | { status: "uncounted" }
  | { status: "error"; reason: string };

// One line's price and macros at its quantity, with the same conversion
// pipeline recomputeMealTotals uses when the recipe is saved, so the live
// preview matches what gets stored.
export function lineTotals(line: DraftIngredient): LineTotals {
  if (!line.ingredient || line.unit === "to taste") return { status: "uncounted" };
  const amount = Number(line.amount);
  if (!(amount > 0)) return { status: "uncounted" };
  const conversion = convertQuantityToBasis(amount, line.unit, line.ingredient);
  if (!conversion.ok) return { status: "error", reason: conversion.reason };
  return { status: "ok", totals: computeItemTotals(line.ingredient, amount, line.unit, null, null) };
}

export type RecipeTotals = {
  price: number;
  calories: number;
  protein: number;
  carbohydrates: number;
  fat: number;
};

// Whole-recipe totals (not per serving) over every line that can be counted.
export function recipeTotals(lines: DraftIngredient[]): RecipeTotals {
  const sum: RecipeTotals = { price: 0, calories: 0, protein: 0, carbohydrates: 0, fat: 0 };
  for (const line of lines) {
    const result = lineTotals(line);
    if (result.status !== "ok") continue;
    sum.price += result.totals.price ?? 0;
    sum.calories += result.totals.calories ?? 0;
    sum.protein += result.totals.protein ?? 0;
    sum.carbohydrates += result.totals.carbohydrates ?? 0;
    sum.fat += result.totals.fat ?? 0;
  }
  return sum;
}
