import type { IngredientFilters } from "@/api/ingredients";

export const adminKeys = {
  ingredients: (filters: IngredientFilters) => ["admin", "ingredients", filters] as const,
  daPdfs: ["admin", "da", "pdfs"] as const,
  daCommodities: ["admin", "da", "commodities"] as const,
  daSavedDates: ["admin", "da", "saved-dates"] as const,
};
