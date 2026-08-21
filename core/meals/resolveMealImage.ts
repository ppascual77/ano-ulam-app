import type { ImageSourcePropType } from "react-native";
import type { MealType } from "./mealTypes";

// Mock meals without a real generated image_url yet fall back to a locally
// bundled placeholder photo, keyed by normalized_name.
const LOCAL_MEAL_IMAGES: Record<string, ImageSourcePropType> = {
  porkadobo: require("@/assets/mock-adobo-meal.jpg"),
  beefkaldereta: require("@/assets/mock-kaldereta-meal.jpg"),
};

export function resolveMealImage(meal: MealType): ImageSourcePropType {
  const local = meal.normalized_name ? LOCAL_MEAL_IMAGES[meal.normalized_name] : undefined;
  if (local) return local;
  return { uri: meal.image_url ?? undefined };
}
