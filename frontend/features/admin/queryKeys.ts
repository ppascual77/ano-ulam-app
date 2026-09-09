import type { IngredientFilters } from "@/api/ingredients";

export const adminKeys = {
  ingredients: (filters: IngredientFilters) => ["admin", "ingredients", filters] as const,
};
