import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { getIngredientNames, getPlannerRice } from "@/api/mealPlans";
import { getMealsUsingIngredients } from "@/api/meals";
import { FALLBACK_RICE_CUP, isOwnCarbIngredient, riceCupFrom, type RiceCup, type RiceIngredient } from "../utils/generatePlan";

const STALE_MS = 30 * 60 * 1000;

// What the planner needs to count rice (BUG-9): one cup's numbers, from the
// catalog's raw rice (FALLBACK_RICE_CUP until it loads), and which meals
// already have rice or noodles in them (no cup counted with those). The bulk
// meal list has no ingredients, so the second is its own small lookup.
export function usePlannerRice(): { cup: RiceCup; ingredient?: RiceIngredient; ownCarbIds: Set<string> } {
  const rice = useQuery({ queryKey: ["planner", "rice"], queryFn: getPlannerRice, staleTime: STALE_MS });
  const ownCarb = useQuery({
    queryKey: ["planner", "own-carb-meals"],
    queryFn: async () => {
      const ids = (await getIngredientNames()).filter((i) => isOwnCarbIngredient(i.canonical_name)).map((i) => i.id);
      return (await getMealsUsingIngredients(ids)).map((m) => m.id);
    },
    staleTime: STALE_MS,
  });
  const cup = useMemo(() => riceCupFrom(rice.data) ?? FALLBACK_RICE_CUP, [rice.data]);
  const ownCarbIds = useMemo(() => new Set(ownCarb.data ?? []), [ownCarb.data]);
  const ingredient = useMemo<RiceIngredient | undefined>(
    () =>
      rice.data
        ? { id: rice.data.id, name: rice.data.canonical_name, displayName: rice.data.display_name, category: rice.data.category }
        : undefined,
    [rice.data],
  );
  return { cup, ingredient, ownCarbIds };
}
