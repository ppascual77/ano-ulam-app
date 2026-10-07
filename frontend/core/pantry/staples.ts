// Common pantry staples most Filipino kitchens already have, offered as a
// one-tap add in the pantry sheet ("Add common condiments" -> View all).
// Each resolves to a real ingredients-table row (so it behaves exactly like
// one picked through search): the first catalog name listed that exists,
// matched case-insensitively. A staple with no match is left out.
export type PantryStaple = { label: string; names: string[] };

export const PANTRY_STAPLES: PantryStaple[] = [
  { label: "Soy sauce", names: ["Soy sauce"] },
  { label: "Vinegar", names: ["Vinegar, white", "Vinegar, cane"] },
  { label: "Garlic", names: ["Garlic", "Garlic, raw"] },
  { label: "Onion", names: ["Onion", "Onion, red, raw", "Onion, white, raw"] },
  { label: "Salt", names: ["Salt"] },
  { label: "Pepper", names: ["Black pepper, ground", "Black peppercorns, whole"] },
  { label: "Sugar", names: ["Sugar, white", "Sugar"] },
  { label: "Fish sauce", names: ["Fish sauce"] },
  { label: "Cooking oil", names: ["Cooking oil"] },
  { label: "Oyster sauce", names: ["Oyster sauce"] },
  { label: "Ginger", names: ["Ginger, raw", "Ginger"] },
];
