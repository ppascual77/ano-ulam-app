import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { listGroceryChecks } from "@/api/groceryChecks";
import { usePantry } from "@/frontend/core/pantry/hooks/usePantry";
import { useSavedMealsForGrocery } from "./useSavedMealsForGrocery";
import { buildGroceryList } from "../utils/buildGroceryList";
import { groupGroceryItems } from "../utils/groupGroceryItems";
import { groceryChecksKey } from "./useGroceryChecks";

// How many ingredients of the saved meals on the list are still to buy (not
// ticked off and not already at home), for Home's cart badge.
// Read-only on purpose: it reads the checks the server has (the same cache
// useGroceryChecks updates when the sheet closes), and never holds pending
// checkbox changes of its own, so it can't send stale ones.
export function useGroceryToBuyCount(userId: string | null) {
  const saved = useSavedMealsForGrocery(userId);
  const { data: pantry = [] } = usePantry();
  const checks = useQuery({
    queryKey: groceryChecksKey("saved", userId),
    queryFn: () => (userId ? listGroceryChecks("saved") : Promise.resolve({} as Record<string, string>)),
    enabled: !!userId,
  });
  return useMemo(() => {
    const items = buildGroceryList(saved.onList);
    return groupGroceryItems(items, pantry, (item) => {
      const value = checks.data?.[item.id];
      return value == null ? "none" : value === item.qty ? "checked" : "stale";
    }).toBuy.length;
  }, [saved.onList, pantry, checks.data]);
}
