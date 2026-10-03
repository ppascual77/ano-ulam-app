import { useQuery, useQueryClient } from "@tanstack/react-query";
import { getPantry, savePantry, type PantryIngredient } from "../mock/api";

const pantryKeys = { list: ["pantry", "list"] as const };

export function usePantry() {
  return useQuery({ queryKey: pantryKeys.list, queryFn: getPantry, staleTime: Infinity });
}

// Edits go straight into the cached list (so Grocery's "Have" tags see
// them right away); `persist` saves the list. Like the web, the pantry is
// saved on "Find Meals" and when leaving, not on every change.
export function usePantryActions() {
  const queryClient = useQueryClient();
  const read = () => queryClient.getQueryData<PantryIngredient[]>(pantryKeys.list) ?? [];
  const write = (next: PantryIngredient[]) => queryClient.setQueryData(pantryKeys.list, next);

  return {
    add: (item: PantryIngredient) => {
      const current = read();
      if (!current.some((i) => i.id === item.id)) write([...current, item]);
    },
    remove: (id: string) => write(read().filter((i) => i.id !== id)),
    persist: () => savePantry(read()),
  };
}

// Whether a grocery item is something the user already has: a pantry name
// appears in the item name, followed by the end or a space , ( or ).
export function pantryHas(pantry: PantryIngredient[], itemName: string): boolean {
  const name = itemName.toLowerCase();
  return pantry.some((p) => {
    const needle = p.name.toLowerCase();
    let from = name.indexOf(needle);
    while (from !== -1) {
      const next = name[from + needle.length];
      if (next === undefined || " ,()".includes(next)) return true;
      from = name.indexOf(needle, from + 1);
    }
    return false;
  });
}
