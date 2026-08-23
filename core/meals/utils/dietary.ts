import { Drumstick, Fish, Leaf, Salad, Sprout } from "lucide-react-native";
import type { LucideIcon } from "lucide-react-native";

// Shared by MealDetailContent's dietary tag pills and the Preferences
// "Active Preferences" summary — same icon per dietary focus everywhere.
export const DIETARY_ICONS: Record<string, LucideIcon> = {
  vegan: Sprout,
  vegetarian: Leaf,
  keto: Drumstick,
  paleo: Salad,
  pescatarian: Fish,
};

export function capitalize(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}
