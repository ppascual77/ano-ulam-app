import { useState } from "react";
import { Pressable, Text, View } from "react-native";
import { Image } from "expo-image";
import {
  Bookmark,
  ChevronRight,
  Clock,
  Heart,
  ShieldCheck,
  Store,
} from "lucide-react-native";
import { AppText, Button, Chips } from "@/components/ui";
import { colors } from "@/constants/theme";
import { MealInfoPill } from "../MealInfoPill";
import { MacroBreakdown } from "./MacroBreakdown";
import { resolveMealImage } from "@/core/meals/resolveMealImage";
import type { MealType } from "@/core/meals/mealTypes";

const CARD_WIDTH = 250;
const IMAGE_HEIGHT = 150;

type MealCardProps = {
  meal: MealType;
  onPress: () => void;
  isFastFood?: boolean;
  /** Defaults to 250 (the carousel size) — pass a smaller value for a grid. */
  width?: number;
  /** "grid" is the See All screen: calories move to a top-left overlay
   *  instead of sitting in the macro breakdown row. Defaults to "carousel". */
  layout?: "carousel" | "grid";
};

// Reused across Home's Recommendations, Discover, and (eventually) saved
// meals — keep this generic to "a meal" and free of any one screen's logic.
export function MealCard({
  meal,
  onPress,
  isFastFood = false,
  width = CARD_WIDTH,
  layout = "carousel",
}: MealCardProps) {
  const isGrid = layout === "grid";
  const [isSaved, setIsSaved] = useState(false);
  const [isLiked, setIsLiked] = useState(meal.liked_by_me ?? false);
  const [likeCount, setLikeCount] = useState(meal.like_count ?? 0);

  // No backend yet — bookmark/like are local-only UI state, not persisted.
  const toggleLike = () => {
    setIsLiked((prev) => !prev);
    setLikeCount((prev) => (isLiked ? prev - 1 : prev + 1));
  };

  return (
    <Pressable
      onPress={onPress}
      style={{ width }}
      className="overflow-hidden rounded-2xl border border-ink-emphasis/10 bg-white shadow-sm"
    >
      <View className="relative">
        <Image
          source={resolveMealImage(meal)}
          style={{ width, height: IMAGE_HEIGHT }}
          contentFit="cover"
        />

        {isGrid && (
          <>
            {/* Scrim so the plain white calorie text (no chip background) stays readable over any photo. */}
            <View className="absolute left-0 right-0 top-0 h-10 bg-black/10" />
            <View className="absolute left-2 top-2">
              <Text className="font-inter-extrabold text-caption text-white">{meal.calories} kcal</Text>
            </View>
          </>
        )}

        {!isFastFood ? (
          <View className="absolute right-2 top-2">
            <Chips
              label={`${meal.total_time} min`}
              icon={<Clock color={colors.white} size={10} strokeWidth={2} />}
            />
          </View>
        ) : (
          <View className={`absolute left-2 flex-row gap-1 ${isGrid ? "top-8" : "top-2"}`}>
            <Chips
              label={meal.restaurant ?? ""}
              icon={<Store color={colors.white} size={10} strokeWidth={2} />}
              bgClassName="bg-accent"
            />
            {meal.source_type === "official" && (
              <Chips
                label="Verified Macros"
                icon={
                  <ShieldCheck color={colors.white} size={10} strokeWidth={2} />
                }
              />
            )}
          </View>
        )}

        <View className="absolute bottom-1 left-1 right-1 flex-row items-end justify-between">
          <MealInfoPill meal={meal} iconOnly={isGrid} />

          <View className="mr-1 items-center gap-1.5">
            {meal.id && (
              <Pressable onPress={toggleLike} className="items-center gap-0.5">
                <View
                  className={`h-9 w-9 items-center justify-center rounded-full border ${
                    isLiked
                      ? "border-like bg-like"
                      : "border-white/20 bg-white/15"
                  }`}
                >
                  <Heart
                    color={colors.white}
                    size={16}
                    fill={isLiked ? colors.white : "none"}
                  />
                </View>
                <Text
                  className={`text-[10px] font-semibold leading-none text-white ${
                    likeCount > 0 ? "opacity-100" : "opacity-0"
                  }`}
                >
                  {likeCount}
                </Text>
              </Pressable>
            )}

            <Pressable
              onPress={() => setIsSaved((prev) => !prev)}
              className={`h-9 w-9 items-center justify-center rounded-full border ${
                isSaved
                  ? "border-primary bg-primary"
                  : "border-white/20 bg-white/15"
              }`}
            >
              <Bookmark
                color={colors.white}
                size={16}
                fill={isSaved ? colors.white : "none"}
              />
            </Pressable>
          </View>
        </View>
      </View>

      <View className="px-4 pt-2">
        <View>
          <AppText
            variant="title"
            numberOfLines={1}
            className="text-ink-emphasis mt-2"
          >
            {meal.name}
          </AppText>
        </View>

        <View className="mt-2">
          <AppText variant="title" className="font-inter-semibold text-primary">
            ₱{meal.price}
            {meal.buffer_price ? ` – ₱${meal.buffer_price}` : ""}
          </AppText>
          <AppText
            variant="caption"
            className="font-inter-light"
            style={{ fontSize: 13 }}
          >
            Estimated Price
          </AppText>

          <View className="mb-3">
            <MacroBreakdown
              macros={{
                calories: meal.calories,
                protein: meal.protein,
                carbs: meal.carbs,
                fats: meal.fats,
              }}
              showCalories={!isGrid}
            />
          </View>
        </View>
      </View>
    </Pressable>
  );
}
