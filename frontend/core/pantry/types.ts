// An ingredient in the user's pantry: a real ingredients row (id) and its
// name, as picked in the Add Ingredients sheet.
export type PantryIngredient = { id: string; name: string };

// Suggestions unlock at this many ingredients.
export const PANTRY_MIN_FOR_SUGGESTIONS = 3;
