import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { getIngredientsForMatching } from "@/api/meals";
import { PANTRY_STAPLES } from "../staples";

export type ResolvedStaple = { label: string; id: string; name: string };

// The staples that exist in the ingredient catalog, each with its row id and
// canonical name. Shares IngredientSearch's catalog query (same key), so the
// catalog is fetched once for both.
export function usePantryStaples() {
  const { data: catalog, isLoading } = useQuery({
    queryKey: ["ingredients", "matching"],
    queryFn: getIngredientsForMatching,
    staleTime: 10 * 60 * 1000,
  });

  const staples = useMemo<ResolvedStaple[]>(() => {
    if (!catalog) return [];
    const byName = new Map(catalog.map((row) => [row.canonical_name.toLowerCase(), row]));
    return PANTRY_STAPLES.flatMap((staple) => {
      const row = staple.names.map((n) => byName.get(n.toLowerCase())).find(Boolean);
      return row ? [{ label: staple.label, id: row.id, name: row.canonical_name }] : [];
    });
  }, [catalog]);

  return { staples, isLoading };
}
