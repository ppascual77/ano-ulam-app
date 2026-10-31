import type { ImageSource } from "expo-image";

// The app's ingredient categories and their icons (assets/icons/), for
// Price Watch's category grid and the pantry's Add Ingredients sheet.

export type IngredientCategory = "meat" | "fish" | "vegetables" | "fruits" | "grains" | "eggs" | "spices" | "other" | "condiments";

// Filenames as provided in assets/icons/: "vegetable.icon.png" and
// "egg-icon.png" don't follow the other files' "<category>-icon.png"
// naming, kept as-is rather than renamed.
export const INGREDIENT_CATEGORY_ICONS: Record<IngredientCategory, ImageSource | number> = {
  meat: require("@/assets/icons/meat-icon.png"),
  fish: require("@/assets/icons/fish-icon.png"),
  vegetables: require("@/assets/icons/vegetable.icon.png"),
  fruits: require("@/assets/icons/fruits-icon.png"),
  grains: require("@/assets/icons/grains-icon.png"),
  eggs: require("@/assets/icons/egg-icon.png"),
  spices: require("@/assets/icons/spices-icon.png"),
  other: require("@/assets/icons/other-icon.png"),
  condiments: require("@/assets/icons/oil-icon.png")
};
