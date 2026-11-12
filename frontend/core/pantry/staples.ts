// Common pantry staples most Filipino kitchens already have, offered as a
// one-tap add in the pantry sheet ("Add common condiments" -> View all).
// Each resolves to a real ingredients-table row (so it behaves exactly like
// one picked through search): the first catalog name listed that exists,
// matched case-insensitively. A staple with no match is left out.
export type StapleGroup = "sauces" | "seasonings" | "aromatics";

export type PantryStaple = { label: string; names: string[]; group: StapleGroup };

// The staples checklist's sections, in order.
export const STAPLE_GROUPS: { key: StapleGroup; label: string }[] = [
  { key: "sauces", label: "Sauces & oil" },
  { key: "seasonings", label: "Seasonings" },
  { key: "aromatics", label: "Aromatics" },
];

export const PANTRY_STAPLES: PantryStaple[] = [
  { label: "Soy sauce", names: ["Soy sauce"], group: "sauces" },
  { label: "Vinegar", names: ["Vinegar, white", "Vinegar, cane"], group: "sauces" },
  { label: "Fish sauce", names: ["Fish sauce"], group: "sauces" },
  { label: "Oyster sauce", names: ["Oyster sauce"], group: "sauces" },
  { label: "Cooking oil", names: ["Cooking oil"], group: "sauces" },
  { label: "Salt", names: ["Salt"], group: "seasonings" },
  { label: "Pepper", names: ["Black pepper, ground", "Black peppercorns, whole"], group: "seasonings" },
  { label: "Sugar", names: ["Sugar, white", "Sugar"], group: "seasonings" },
  { label: "Garlic", names: ["Garlic", "Garlic, raw"], group: "aromatics" },
  { label: "Onion", names: ["Onion", "Onion, red, raw", "Onion, white, raw"], group: "aromatics" },
  { label: "Ginger", names: ["Ginger, raw", "Ginger"], group: "aromatics" },
];

// What the Add Ingredients sheet offers before anything is typed: the
// things most people add first. Resolved the same way as the staples.
export const QUICK_ADDS: string[][] = [
  ["Garlic", "Garlic, raw"],
  ["Onion, red, raw", "Onion"],
  ["Chicken egg, raw"],
  ["Rice, white, raw"],
  ["Chicken thigh, raw", "Chicken leg quarter, raw"],
  ["Tomato, raw"],
];
