// How grocery items read on the list: shopper names instead of catalog names,
// and the store section each one is picked up in.

// Words in a catalog name that only matter to nutrition data, not to what
// you pick up ("Beef sirloin, raw", "Chickpeas, canned, drained").
const DROPPED = new Set(["raw", "fresh", "uncooked", "drained", "chopped", "sliced", "minced"]);

// Cuts and parts come after the meat, not before ("Chicken, thigh" is
// "Chicken thigh", not "Thigh chicken").
const PARTS = new Set([
  "thigh", "thighs", "breast", "breasts", "wing", "wings", "leg", "legs", "drumstick", "drumsticks", "belly", "shoulder",
  "loin", "tenderloin", "liver", "gizzard", "gizzards", "feet", "neck", "ribs", "spareribs", "chop", "chops", "fillet",
  "fillets", "head", "tail", "shank", "hock", "skin", "blood", "intestines", "tripe", "steak", "cubes",
]);

const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** What a shopper calls it: the ingredient's display name when it has one,
 *  else the catalog name made readable. "Bell pepper, green, raw" becomes
 *  "Green bell pepper", "Beef sirloin, raw" becomes "Beef sirloin",
 *  "Vinegar, white" becomes "White vinegar". */
export function groceryName(canonicalName: string, displayName?: string | null): string {
  if (displayName?.trim()) return capitalize(displayName.trim());
  const [base, ...rest] = canonicalName.split(",").map((part) => part.trim()).filter(Boolean);
  if (!base) return canonicalName.trim();
  // One describing word or two at most ("green", "dark baking" reads badly
  // flipped, so longer ones stay as they are).
  const describer = rest.find((part) => !DROPPED.has(part.toLowerCase()));
  if (!describer) return capitalize(base);
  if (describer.split(/\s+/).length > 2) return capitalize(`${base}, ${describer}`);
  if (PARTS.has(describer.toLowerCase())) return capitalize(`${base} ${describer.toLowerCase()}`);
  return capitalize(`${describer.toLowerCase()} ${base.toLowerCase()}`);
}

// Store sections, in the order you'd walk a Filipino supermarket or
// palengke run: fresh stuff first, packaged goods last.
export const GROCERY_SECTIONS = ["produce", "meat", "seafood", "dairy", "grains", "pantry"] as const;
export type GrocerySectionKey = (typeof GROCERY_SECTIONS)[number];

export const GROCERY_SECTION_LABELS: Record<GrocerySectionKey, string> = {
  produce: "Produce",
  meat: "Meat & poultry",
  seafood: "Seafood",
  dairy: "Dairy & eggs",
  grains: "Rice, noodles & bread",
  pantry: "Pantry",
};

// Ingredient categories (lowercased) by section. Anything not listed is a
// packaged pantry good (condiments, spices, oils, canned, baking…).
const SECTION_OF: Record<string, GrocerySectionKey> = Object.fromEntries(
  (
    [
      [
        "produce",
        [
          "vegetable", "vegetables", "fruit", "leafy green", "leafy vegetable", "root vegetable", "gourd", "tomato",
          "mushroom", "leaf", "citrus fruit", "aromatics", "allium", "herb", "herbs",
        ],
      ],
      ["meat", ["pork", "beef", "poultry", "poultry product", "meat", "chicken", "processed meat"]],
      ["seafood", ["fish", "shellfish", "mollusk", "seafood", "processed seafood"]],
      ["dairy", ["dairy", "egg", "eggs", "cheese", "keso", "dairy substitute"]],
      ["grains", ["rice", "grain", "grains", "noodles", "pasta", "bread", "flatbread"]],
    ] as [GrocerySectionKey, string[]][]
  ).flatMap(([section, categories]) => categories.map((category) => [category, section])),
);

export function grocerySection(category: string | null | undefined): GrocerySectionKey {
  return SECTION_OF[category?.trim().toLowerCase() ?? ""] ?? "pantry";
}
