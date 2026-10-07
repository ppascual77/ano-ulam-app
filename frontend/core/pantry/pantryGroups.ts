// How pantry ingredients are grouped into Home's pantry tabs, from each
// ingredient's catalog `category`. Anything unlisted is a Staple.
export type PantryGroup = "condiments" | "fresh" | "veggies" | "staples";

export const PANTRY_GROUPS: { key: PantryGroup; label: string; chipClass: string }[] = [
  // Chip tints are existing tokens: cream, blush, soft green, peach.
  { key: "condiments", label: "Condiments", chipClass: "bg-tag-bg" },
  { key: "fresh", label: "Fresh Foods", chipClass: "bg-category-fastfood" },
  { key: "veggies", label: "Veggies", chipClass: "bg-tinted-bg" },
  { key: "staples", label: "Staples", chipClass: "bg-category-breakfast" },
];

const BY_CATEGORY: Record<string, PantryGroup> = {
  "condiments & sauces": "condiments",
  seasonings: "condiments",
  spice: "condiments",
  spices: "condiments",
  herb: "condiments",
  oils: "condiments",
  sweetener: "condiments",
  pork: "fresh",
  beef: "fresh",
  poultry: "fresh",
  fish: "fresh",
  mollusk: "fresh",
  shellfish: "fresh",
  egg: "fresh",
  dairy: "fresh",
  fruit: "fresh",
  vegetable: "veggies",
  "leafy green": "veggies",
  "root vegetable": "veggies",
  mushroom: "veggies",
  legume: "veggies",
  aromatics: "veggies",
};

export function pantryGroupOf(category: string | null | undefined): PantryGroup {
  return BY_CATEGORY[category?.trim().toLowerCase() ?? ""] ?? "staples";
}
