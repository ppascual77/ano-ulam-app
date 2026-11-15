import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { listGroceryChecks } from "@/api/groceryChecks";
import { useSavedMealsForGrocery } from "./useSavedMealsForGrocery";
import { buildGroceryList } from "../utils/buildGroceryList";
import { applyStaplesToBuy, useStaplesToBuy } from "../store/useStaplesToBuyStore";
import { groceryChecksKey } from "./useGroceryChecks";

// How many saved-meal ingredients are still to buy (main ingredients, and
// staples moved to "To buy", not checked off), for Home's cart badge.
// Read-only on purpose: it reads the checks the server has (the same cache
// useGroceryChecks updates when the sheet closes), and never holds pending
// checkbox changes of its own, so it can't send stale ones.
export function useGroceryToBuyCount(userId: string | null) {
  const saved = useSavedMealsForGrocery();
  const staplesToBuy = useStaplesToBuy();
  const checks = useQuery({
    queryKey: groceryChecksKey("saved", userId),
    queryFn: () => (userId ? listGroceryChecks("saved") : Promise.resolve({} as Record<string, string>)),
    enabled: !!userId,
  });
  return useMemo(() => {
    const items = applyStaplesToBuy(buildGroceryList(saved.meals), staplesToBuy);
    // Checked at a different quantity = needs restocking = still to buy.
    return items.filter((item) => item.category === "main" && checks.data?.[item.id] !== item.qty).length;
  }, [saved.meals, staplesToBuy, checks.data]);
}
