// Browse's search filters. Only the Craving chips set them now (the filter
// sheet was removed): one chip = one ready-made filter. The values are what
// the search filters on (api/meals.ts browseMeals).

export type SortByPrice = "asc" | "desc";

export type MealFilters = {
  /** Meal protein_type values ("vegetable" also matches "vegetarian"). */
  proteinTypes: string[];
  dietaryTags: string[];
  tags: string[];
  restaurants: string[];
  sortByPrice: SortByPrice | null;
  priceRange: [number, number] | null;
};

export const EMPTY_FILTERS: MealFilters = { proteinTypes: [], dietaryTags: [], tags: [], restaurants: [], sortByPrice: null, priceRange: null };

// Whether a search is needed at all: sort alone just reorders.
export function hasQueryFilters(filters: MealFilters) {
  return (
    filters.proteinTypes.length > 0 || filters.tags.length > 0 || filters.dietaryTags.length > 0 || filters.restaurants.length > 0
  );
}
