// Browse filters, same shape and values as the web's FilterModal (the
// values are what the search filters on).

export type SortByPrice = "asc" | "desc";

export type MealFilters = {
  dietaryTags: string[];
  tags: string[];
  restaurants: string[];
  sortByPrice: SortByPrice | null;
  priceRange: [number, number] | null;
};

export const EMPTY_FILTERS: MealFilters = { dietaryTags: [], tags: [], restaurants: [], sortByPrice: null, priceRange: null };

export const PRICE_MIN = 50;
export const PRICE_MAX = 700;
export const PRICE_STEP = 10;

export type FilterOption = { label: string; value: string };

export const SORT_OPTIONS: { label: string; value: SortByPrice }[] = [
  { label: "Price: Low to High", value: "asc" },
  { label: "Price: High to Low", value: "desc" },
];

export const MEAL_STYLE_OPTIONS: FilterOption[] = [
  { label: "High Protein", value: "high_protein" },
  { label: "Low Calorie", value: "low_calorie" },
  { label: "Filling", value: "filling" },
  { label: "Quick (< 20 min)", value: "quick" },
  { label: "Low Carb", value: "low_carb" },
  { label: "Soupy", value: "soupy" },
  { label: "Grilled", value: "grilled" },
  { label: "Fried", value: "fried" },
];

export const DIETARY_OPTIONS: FilterOption[] = [
  { label: "Vegan", value: "vegan" },
  { label: "Vegetarian", value: "vegetarian" },
  { label: "Keto", value: "keto" },
  { label: "Paleo", value: "paleo" },
  { label: "Pescatarian", value: "pescatarian" },
];

// "Mcdonald's" (sic) matches the web; api/meals.ts also tries "McDonald's".
export const RESTAURANT_OPTIONS: FilterOption[] = [
  { label: "McDonald's", value: "Mcdonald's" },
  { label: "Jollibee", value: "Jollibee" },
  { label: "Marugame Udon", value: "Marugame Udon" },
  { label: "KFC", value: "KFC" },
  { label: "Mang Inasal", value: "Mang Inasal" },
  { label: "Burger King", value: "Burger King" },
];

// The price range only applies alongside another filter (sort doesn't
// count): with none picked, the slider is locked and the range dropped.
export function isPriceUnlocked(filters: MealFilters) {
  return filters.tags.length > 0 || filters.dietaryTags.length > 0 || filters.restaurants.length > 0;
}

export function countFilters(filters: MealFilters) {
  return (
    filters.dietaryTags.length +
    filters.tags.length +
    filters.restaurants.length +
    (filters.sortByPrice ? 1 : 0) +
    (filters.priceRange && isPriceUnlocked(filters) ? 1 : 0)
  );
}

// What Apply commits: a locked price range is dropped.
export function finalizeFilters(filters: MealFilters): MealFilters {
  return isPriceUnlocked(filters) ? filters : { ...filters, priceRange: null };
}

// Whether a search is needed at all: sort alone just reorders.
export function hasQueryFilters(filters: MealFilters) {
  return isPriceUnlocked(filters);
}
