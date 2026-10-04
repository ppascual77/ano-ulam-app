import { View, type DimensionValue } from "react-native";
import { Image } from "expo-image";
import { CookingPot, Utensils } from "lucide-react-native";
import { colors } from "@/frontend/constants/theme";
import { resolveMealImage } from "@/frontend/core/meals/resolveMealImage";
import type { MealType } from "@/frontend/core/meals/mealTypes";

type ImagePlaceholderProps = {
  height: DimensionValue;
  width?: DimensionValue;
  /** "hero" for the screen illustrations, "meal" for meal photos. */
  kind?: "hero" | "meal";
  rounded?: string;
};

// PLACEHOLDER until the hero illustrations and meal photos are supplied: a
// soft green tile with an icon.
export function ImagePlaceholder({ height, width = "100%", kind = "meal", rounded = "rounded-2xl" }: ImagePlaceholderProps) {
  const Icon = kind === "hero" ? CookingPot : Utensils;
  return (
    <View style={{ height, width }} className={`items-center justify-center bg-tinted-bg ${rounded}`}>
      <Icon color={colors.primary} size={kind === "hero" ? 44 : 22} strokeWidth={1.5} opacity={0.6} />
    </View>
  );
}

// A meal's photo when it has one (real catalog meals), else the placeholder.
export function MealImage({ meal, height, width = "100%", rounded = "rounded-2xl" }: { meal: MealType; height: number; width?: DimensionValue; rounded?: string }) {
  if (!meal.image_url) return <ImagePlaceholder height={height} width={width} rounded={rounded} />;
  return (
    <View style={{ height, width }} className={`overflow-hidden ${rounded}`}>
      <Image source={resolveMealImage(meal)} style={{ width: "100%", height: "100%" }} contentFit="cover" />
    </View>
  );
}
