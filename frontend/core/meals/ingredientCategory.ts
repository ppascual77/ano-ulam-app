import type { ImageSourcePropType } from "react-native";
import type { IngredientType } from "./mealTypes";

// The app's ingredient categories and their icons (assets/icons/). Shared by
// the meal page's ingredient rows and Price Watch's category grid.

export type IngredientCategory = "meat" | "fish" | "vegetables" | "fruits" | "grains" | "eggs" | "spices" | "other";

// Filenames as provided in assets/icons/: "vegetable.icon.png" and
// "egg-icon.jpg" don't follow the other files' "<category>-icon.png"
// naming, kept as-is rather than renamed.
export const INGREDIENT_CATEGORY_ICONS: Record<IngredientCategory, ImageSourcePropType> = {
  meat: require("@/assets/icons/meat-icon.png"),
  fish: require("@/assets/icons/fish-icon.png"),
  vegetables: require("@/assets/icons/vegetable.icon.png"),
  fruits: require("@/assets/icons/fruits-icon.png"),
  grains: require("@/assets/icons/grains-icon.png"),
  eggs: require("@/assets/icons/egg-icon.jpg"),
  spices: require("@/assets/icons/spices-icon.png"),
  other: require("@/assets/icons/other-icon.png"),
};

// The ingredients table's finer `category` values, grouped into the icons
// above. Anything not listed (Condiments & Sauces, Oils, Dairy, Sweetener,
// Canned Goods, ...) is "other".
const DB_CATEGORY_GROUPS: Record<string, IngredientCategory> = {
  pork: "meat",
  beef: "meat",
  poultry: "meat",
  meat: "meat",
  fish: "fish",
  mollusk: "fish",
  shellfish: "fish",
  seafood: "fish",
  vegetable: "vegetables",
  "leafy green": "vegetables",
  "root vegetable": "vegetables",
  mushroom: "vegetables",
  legume: "vegetables",
  fruit: "fruits",
  rice: "grains",
  grain: "grains",
  noodles: "grains",
  baking: "grains",
  egg: "eggs",
  spice: "spices",
  herb: "spices",
  aromatics: "spices",
};

// For ingredients without a stored category (mock meals): keyword guesses on
// the name, English and Tagalog. First match wins, so more specific groups
// (eggs, fish) come before broad ones.
const NAME_GUESSES: [RegExp, IngredientCategory][] = [
  [/\b(eggs?|itlog)\b/i, "eggs"], // whole word: not "eggplant"
  [/\b(fish|isda|bangus|tilapia|galunggong|tahong|mussel|shrimp|hipon|prawn|squid|pusit|crab|alimango|clam|halaan|tuna|sardine)/i, "fish"],
  [/\b(pork|baboy|liempo|kasim|beef|baka|chicken|manok|meat|giniling|bacon|ham|sausage|longganisa|chorizo|liver|atay)/i, "meat"],
  [/\b(rice|bigas|kanin|noodle|pancit|flour|harina|bread|tinapay|pasta|oat)/i, "grains"],
  [/\b(bell|green|red|sweet) peppers?\b/i, "vegetables"], // before spices' "pepper"
  [/\b(garlic|bawang|onion|sibuyas|ginger|luya|pepper|paminta|bay leaf|laurel|salt|asin|chili|sili|herb|parsley|basil|oregano|cumin|paprika|lemongrass|tanglad|annatto|atsuete)/i, "spices"],
  [/\b(mango|mangga|banana|saging|calamansi|kalamansi|lemon|lime|pineapple|pinya|apple|orange|papaya|coconut|niyog|buko|tamarind|sampalok)/i, "fruits"],
  [/\b(tomato|kamatis|eggplant|talong|cabbage|repolyo|potato|patatas|carrot|karot|kangkong|spinach|pechay|sitaw|bean|monggo|okra|ampalaya|squash|kalabasa|malunggay|lettuce|cucumber|pipino|mushroom|kabute|radish|labanos|bell pepper|sayote|upo|gabi|kamote|corn|mais)/i, "vegetables"],
];

/** Which icon category an ingredient belongs to: its stored category if it
 *  has one, otherwise a guess from its name, otherwise "other". */
export function ingredientCategory(ingredient: Pick<IngredientType, "name" | "category">): IngredientCategory {
  const stored = ingredient.category?.trim().toLowerCase();
  if (stored) return DB_CATEGORY_GROUPS[stored] ?? "other";
  for (const [pattern, category] of NAME_GUESSES) if (pattern.test(ingredient.name)) return category;
  return "other";
}

// Ingredient rows get a more specific picture than the category grid:
// meat splits by animal (the generic meat icon is a chicken drumstick, which
// read wrong on pork and beef), and fish uses its own newer photo.
const MEAT_ICONS = {
  chicken: require("@/assets/icons/meat-icon.png"),
  beef: require("@/assets/icons/beef-icon.png"),
  pork: require("@/assets/icons/pork-icon.png"),
};
const FISH_ICON = require("@/assets/icons/fish-icon2.png");
// Checked against the stored category and the name together, so both "Pork"
// (category) and "Pork belly" / "Liempo" (name) land on pork.
const MEAT_KINDS: [RegExp, keyof typeof MEAT_ICONS][] = [
  [/\b(chicken|manok|poultry)/i, "chicken"],
  [/\b(beef|baka)/i, "beef"],
  [/\b(pork|baboy|liempo|kasim|pigue)/i, "pork"],
];

/** The picture for an ingredient row or sheet: its category's icon, with
 *  meat narrowed to chicken / beef / pork (generic meat icon otherwise) and
 *  fish using the fish photo. */
export function ingredientCategoryIcon(ingredient: Pick<IngredientType, "name" | "category">): ImageSourcePropType {
  const category = ingredientCategory(ingredient);
  if (category === "fish") return FISH_ICON;
  if (category === "meat") {
    const text = `${ingredient.category ?? ""} ${ingredient.name}`;
    for (const [pattern, kind] of MEAT_KINDS) if (pattern.test(text)) return MEAT_ICONS[kind];
    return MEAT_ICONS.chicken;
  }
  return INGREDIENT_CATEGORY_ICONS[category];
}
