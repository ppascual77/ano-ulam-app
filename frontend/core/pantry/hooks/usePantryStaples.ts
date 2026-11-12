import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { getIngredientsForMatching } from "@/api/meals";
import type { IngredientRow } from "@/api/ingredients";
import { PANTRY_STAPLES, QUICK_ADDS, type StapleGroup } from "../staples";

export type ResolvedStaple = { label: string; id: string; name: string; group: StapleGroup };

// The ingredient catalog, shared by the pantry's search, staples and chips
// (same key as IngredientSearch, so it's fetched once for all of them).
export function useIngredientCatalog() {
  return useQuery({
    queryKey: ["ingredients", "matching"],
    queryFn: getIngredientsForMatching,
    staleTime: 10 * 60 * 1000,
  });
}

function resolver(catalog: IngredientRow[] | undefined) {
  const byName = new Map((catalog ?? []).map((row) => [row.canonical_name.toLowerCase(), row]));
  return (names: string[]) => names.map((n) => byName.get(n.toLowerCase())).find(Boolean);
}

// The staples that exist in the ingredient catalog, each with its row id and
// canonical name, plus the resolved quick-add rows.
export function usePantryStaples() {
  const { data: catalog, isLoading } = useIngredientCatalog();

  const { staples, quickAdds } = useMemo(() => {
    if (!catalog) return { staples: [] as ResolvedStaple[], quickAdds: [] as IngredientRow[] };
    const find = resolver(catalog);
    return {
      staples: PANTRY_STAPLES.flatMap((staple) => {
        const row = find(staple.names);
        return row ? [{ label: staple.label, id: row.id, name: row.canonical_name, group: staple.group }] : [];
      }),
      quickAdds: QUICK_ADDS.flatMap((names) => {
        const row = find(names);
        return row ? [row] : [];
      }),
    };
  }, [catalog]);

  return { staples, quickAdds, isLoading };
}
