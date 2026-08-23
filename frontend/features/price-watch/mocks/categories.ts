import type { ImageSourcePropType } from "react-native";

export type PriceWatchCategory = {
  id: string;
  label: string;
  icon: ImageSourcePropType;
};

// Filenames as provided in assets/icons/ — "vegetable.icon.png" and
// "egg-icon.jpg" don't follow the other files' "<category>-icon.png"
// naming, kept as-is rather than renamed.
export const priceWatchCategories: PriceWatchCategory[] = [
  { id: "meat", label: "Meat", icon: require("@/assets/icons/meat-icon.png") },
  { id: "fish", label: "Fish", icon: require("@/assets/icons/fish-icon.png") },
  { id: "vegetables", label: "Vegetables", icon: require("@/assets/icons/vegetable.icon.png") },
  { id: "fruits", label: "Fruits", icon: require("@/assets/icons/fruits-icon.png") },
  { id: "grains", label: "Grains", icon: require("@/assets/icons/grains-icon.png") },
  { id: "eggs", label: "Eggs", icon: require("@/assets/icons/egg-icon.jpg") },
  { id: "spices", label: "Spices", icon: require("@/assets/icons/spices-icon.png") },
  { id: "other", label: "Other", icon: require("@/assets/icons/other-icon.png") },
];
