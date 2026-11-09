import { Pressable, Text, View } from "react-native";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { Bookmark } from "lucide-react-native";
import { colors } from "@/frontend/constants/theme";
import { useLiveSaveCount } from "@/frontend/core/meals/hooks/useLiveSaveCount";
import { resolveMealImage } from "@/frontend/core/meals/resolveMealImage";
import type { MealType } from "@/frontend/core/meals/mealTypes";

// Over the photos: clear at the top, dark at the bottom so white text reads.
const PHOTO_SHADE = ["rgba(0,0,0,0)", "rgba(0,0,0,0.05)", "rgba(0,0,0,0.72)"] as const;

/** "large": the wide lead tile. "medium": tall or wide supporting tiles.
 *  "small": the stacked half-height tiles (no price line). */
export type MealPhotoTileSize = "large" | "medium" | "small";

export const mealPriceLabel = (meal: MealType) => `₱${meal.price}${meal.buffer_price ? `–${meal.buffer_price}` : ""}`;

// The save count as a pill at a tile's top right: a bookmark and the number,
// on a dark see-through backing so it reads on any photo.
function SavesPill({ meal, compact }: { meal: MealType; compact: boolean }) {
  const saves = useLiveSaveCount(meal);
  return (
    <View className={`flex-row items-center gap-1 rounded-full bg-black/35 ${compact ? "px-2 py-1" : "px-2.5 py-1.5"}`}>
      <Bookmark color={colors.white} fill={colors.white} size={compact ? 11 : 13} strokeWidth={2.5} />
      <Text className={`font-inter-bold text-white ${compact ? "text-sub" : "text-small"}`}>{saves.toLocaleString("en-PH")}</Text>
    </View>
  );
}

type MealPhotoTileProps = {
  meal: MealType;
  size: MealPhotoTileSize;
  height: number;
  /** The big numeral at the top left, before the accent dot: a rank ("01")
   *  in Community Favorites, the mood's number ("₱89", "42g") in Browse. */
  stat: string;
  /** The line under the name (not on small tiles). Defaults to the price. */
  caption?: string;
  onPress: () => void;
  accessibilityLabel: string;
};

// An editorial photo tile: the meal's photo under a dark fade, a big stat
// with the accent dot top left, the saves top right, and the name (and price,
// except on small tiles) over the photo at the bottom. Used by Home's
// Community Favorites spread and Browse's ulam moods.
export function MealPhotoTile({ meal, size, height, stat, caption, onPress, accessibilityLabel }: MealPhotoTileProps) {
  const big = size === "large";
  const small = size === "small";
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      style={{ height }}
      className="overflow-hidden rounded-2xl bg-ink-emphasis/5 active:opacity-90"
    >
      <Image source={resolveMealImage(meal)} style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }} contentFit="cover" transition={250} />
      <LinearGradient colors={PHOTO_SHADE} locations={[0, 0.4, 1]} style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }} />

      <View className={`absolute flex-row items-start justify-between ${small ? "left-3 right-2.5 top-2.5" : "left-4 right-3 top-3"}`}>
        <Text className={`font-inter-extrabold tracking-display text-white ${big ? "text-heading" : "text-subheading"}`}>
          {stat}
          <Text className="text-accent">.</Text>
        </Text>
        <SavesPill meal={meal} compact={small} />
      </View>

      <View className={`absolute bottom-0 left-0 right-0 ${small ? "p-3" : "p-4"}`}>
        <Text
          numberOfLines={2}
          className={`font-inter-extrabold tracking-display text-white ${big ? "text-heading" : small ? "text-body" : "text-subheading"}`}
        >
          {meal.name}
        </Text>
        {!small && <Text className="mt-1 font-inter-bold text-small text-white">{caption ?? mealPriceLabel(meal)}</Text>}
      </View>
    </Pressable>
  );
}
