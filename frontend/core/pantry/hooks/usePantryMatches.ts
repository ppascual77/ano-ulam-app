import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { getIngredientsForMatching, getMealIngredientIndex } from "@/api/meals";
import type { PantryIngredient } from "../mock/api";
import { pantryGroupOf, type PantryGroup } from "../pantryGroups";

// Water is in many recipes but isn't something you "have", so it never
// counts toward (or against) a match.
const WATER = /^water$/i;

/** How ready a meal is to cook from the pantry (see matchTier). */
export type MatchTier = "cookNow" | "almost" | "trip";

export type PantryMealMatch = {
  mealId: string;
  tier: MatchTier;
  /** What you'd still need, as catalog names, main ingredients first. */
  missing: { name: string; main: boolean }[];
  /** Ingredients of this meal you have / still need (water excluded). */
  have: number;
  need: number;
  /** have / (have + need), 0-100. */
  percent: number;
};

export type PantryMatchSummary = {
  /** Meals that use at least one pantry ingredient. */
  matchedMeals: number;
  /** Average share (0-100) of a matched meal's ingredients you already have. */
  averageMatch: number;
  /** Every matched meal, best match first (then most ingredients you have). */
  results: PantryMealMatch[];
};

// Readiness: "Cook now" when nothing main is missing and at most a couple of
// pantry basics are (salt-level things); "Almost there" when at most a couple
// of ingredients are missing in total; otherwise worth a palengke trip.
const COOK_NOW_MAX_MISSING_BASICS = 2;
const ALMOST_MAX_MISSING = 2;

function matchTier(missing: { main: boolean }[]): MatchTier {
  if (!missing.some((m) => m.main) && missing.length <= COOK_NOW_MAX_MISSING_BASICS) return "cookNow";
  if (missing.length <= ALMOST_MAX_MISSING) return "almost";
  return "trip";
}

/** How well the catalog's meals match the pantry, by ingredient id. */
export function usePantryMatches(pantry: PantryIngredient[]) {
  const { data: index, isLoading } = useQuery({
    queryKey: ["meals", "ingredient-index"],
    queryFn: getMealIngredientIndex,
    staleTime: 5 * 60 * 1000,
  });

  const summary = useMemo<PantryMatchSummary>(() => {
    const have = new Set(pantry.map((p) => p.id));
    const results: PantryMealMatch[] = [];
    for (const meal of index ?? []) {
      // One entry per distinct ingredient (a recipe can list one twice).
      const ingredients = new Map<string, { name: string; main: boolean }>();
      for (const mi of meal.meal_ingredients) {
        const name = mi.ingredient?.canonical_name ?? "";
        if (WATER.test(name) || ingredients.has(mi.ingredient_id)) continue;
        ingredients.set(mi.ingredient_id, { name, main: mi.ingredient?.role === "main" });
      }
      if (ingredients.size === 0) continue;
      let matched = 0;
      const missing: { name: string; main: boolean }[] = [];
      for (const [id, info] of ingredients) {
        if (have.has(id)) matched++;
        else missing.push(info);
      }
      if (matched > 0) {
        missing.sort((a, b) => Number(b.main) - Number(a.main));
        results.push({
          mealId: meal.id,
          tier: matchTier(missing),
          missing,
          have: matched,
          need: missing.length,
          percent: Math.round((matched / ingredients.size) * 100),
        });
      }
    }
    results.sort((a, b) => b.percent - a.percent || b.have - a.have);
    return {
      matchedMeals: results.length,
      averageMatch: results.length ? Math.round(results.reduce((sum, r) => sum + r.have / (r.have + r.need), 0) / results.length * 100) : 0,
      results,
    };
  }, [index, pantry]);

  return { ...summary, isLoading };
}

/** Each pantry item's tab group, from its catalog category (shares the
 *  ingredient search's catalog query). */
export function usePantryGroups(pantry: PantryIngredient[]) {
  const { data: catalog } = useQuery({
    queryKey: ["ingredients", "matching"],
    queryFn: getIngredientsForMatching,
    staleTime: 10 * 60 * 1000,
  });
  return useMemo(() => {
    const categoryById = new Map((catalog ?? []).map((row) => [row.id, row.category]));
    return new Map<string, PantryGroup>(pantry.map((p) => [p.id, pantryGroupOf(categoryById.get(p.id))]));
  }, [catalog, pantry]);
}
