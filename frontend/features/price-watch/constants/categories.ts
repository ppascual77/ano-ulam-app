import type { ImageSourcePropType } from "react-native";
import { INGREDIENT_CATEGORY_ICONS as ICONS } from "@/frontend/core/meals/ingredientCategory";
import type { PriceCategory } from "@/frontend/core/prices/utils/prices";

export type PriceWatchCategory = {
  id: PriceCategory;
  label: string;
  icon: ImageSourcePropType;
};

// Icons are shared with the meal page's ingredient rows (see
// core/meals/ingredientCategory.ts).
export const priceWatchCategories: PriceWatchCategory[] = [
  { id: "meat", label: "Meat", icon: ICONS.meat },
  { id: "fish", label: "Fish", icon: ICONS.fish },
  { id: "vegetables", label: "Vegetables", icon: ICONS.vegetables },
  { id: "fruits", label: "Fruits", icon: ICONS.fruits },
  { id: "grains", label: "Grains", icon: ICONS.grains },
  { id: "eggs", label: "Eggs", icon: ICONS.eggs },
  { id: "spices", label: "Spices", icon: ICONS.spices },
  { id: "other", label: "Other", icon: ICONS.other },
];
