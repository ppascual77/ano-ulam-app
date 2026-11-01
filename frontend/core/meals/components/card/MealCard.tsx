import { ReactNode, useState } from "react";
import { Pressable, Text, View } from "react-native";
import { Image } from "expo-image";
import { ChevronRight, Clock, ShieldCheck, Store, Target } from "lucide-react-native";
import { useNutritionGoals } from "@/frontend/core/preferences/hooks/useNutritionGoals";
import { fitsGoals } from "@/frontend/core/nutrition/goalFit";
import { AppText, Button, Chips } from "@/frontend/components/ui";
import { colors } from "@/frontend/constants/theme";
import { MealInfoPill } from "../MealInfoPill";
import { MacroBreakdown } from "./MacroBreakdown";
import { resolveMealImage } from "@/frontend/core/meals/resolveMealImage";
import type { MealType } from "@/frontend/core/meals/mealTypes";
import { MealSaveButton } from "./MealSaveButton";

const CARD_WIDTH = 250;
const IMAGE_HEIGHT = 150;

type MealCardProps = {
  meal: MealType;
  onPress: () => void;
  isFastFood?: boolean;
  /** Defaults to 250 (the carousel size) — pass a smaller value for a grid. */
  width?: number;
  /** "grid" is the See All screen: calories move to a bottom-right overlay
   *  instead of sitting in the macro breakdown row. Defaults to "carousel". */
  layout?: "carousel" | "grid";
  /** Two-line description under the name (off by default to keep carousel
   *  cards compact). */
  showDescription?: boolean;
  /** Adds a tinted "View Details" button at the bottom of the card. */
  onViewDetails?: () => void;
  /** Replaces the default save/unsave toggle (e.g. Profile asks "Remove
   *  this meal?" before unsaving). Saved state still comes from the shared
   *  saved list. */
  onBookmarkPress?: () => void;
  /** Hide the bookmark (e.g. a recipe still under review). */
  hideActions?: boolean;
  /** Hide just the bookmark button, keeping its count (someone else's
   *  saved list). */
  hideBookmark?: boolean;
  /** Overlays on the photo: a badge top-left (recipe status), a control
   *  top-right beside the bookmark (owner menu), and a strip along the
   *  bottom edge (saved meal's catalog status). */
  topLeft?: ReactNode;
  topRight?: ReactNode;
  imageFooter?: ReactNode;
  /** Faded card (a rejected recipe). */
  dimmed?: boolean;
};

// Reused across Home's Recommendations, Discover, and (eventually) saved
// meals — keep this generic to "a meal" and free of any one screen's logic.
export function MealCard({
  meal,
  onPress,
  isFastFood = false,
  width = CARD_WIDTH,
  layout = "carousel",
  showDescription = false,
  onViewDetails,
  onBookmarkPress,
  hideActions = false,
  hideBookmark = false,
  topLeft,
  topRight,
  imageFooter,
  dimmed = false,
}: MealCardProps) {
  const isGrid = layout === "grid";
  // Pro with nutrition goals: a tag when a serving fits a meal's share.
  const goals = useNutritionGoals();
  const fits = !!goals && fitsGoals(meal, goals);
  return (
    <Pressable
      onPress={onPress}
      style={{ width }}
      className={`overflow-hidden rounded-2xl border border-ink-emphasis/10 bg-white shadow-sm ${dimmed ? "opacity-75" : ""}`}
    >
      <View className="relative">
        <Image
          source={resolveMealImage(meal)}
          style={{ width, height: IMAGE_HEIGHT }}
          contentFit="cover"
        />

        {/* Scrim so the plain white calorie text (no chip background) stays readable over any photo. */}
        {isGrid && <View className="absolute bottom-0 left-0 right-0 h-10 bg-black/10" />}

        {/* Top-left: time, fast-food chips, a badge. Stops
            short of the bookmark, wrapping instead of running under it. */}
        <View className="absolute left-2 right-12 top-2 min-h-9 flex-row flex-wrap items-center gap-1">
          {!isFastFood && (
            <Chips
              label={`${meal.total_time} min`}
              icon={<Clock color={colors.white} size={10} strokeWidth={2} />}
            />
          )}
          {isFastFood && (
            <>
              <Chips
                label={meal.restaurant ?? ""}
                icon={<Store color={colors.white} size={10} strokeWidth={2} />}
                bgClassName="bg-accent"
              />
              {meal.source_type === "official" && (
                <Chips
                  label="Verified Macros"
                  icon={
                    <ShieldCheck
                      color={colors.white}
                      size={10}
                      strokeWidth={2}
                    />
                  }
                />
              )}
            </>
          )}
          {fits && (
            <Chips label="Fits your goals" icon={<Target color={colors.white} size={10} strokeWidth={2} />} bgClassName="bg-primary" />
          )}
          {topLeft}
        </View>

        {/* Top-right: a control (owner menu), then the bookmark with its
            save count under it. */}
        <View className="absolute right-2 top-2 flex-row items-start gap-1.5">
          {topRight}
          {!hideActions && (
            <MealSaveButton meal={meal} onPress={onBookmarkPress} hideButton={hideBookmark} />
          )}
        </View>

        {imageFooter && (
          <View className="absolute bottom-0 left-0 right-0">
            {imageFooter}
          </View>
        )}

        {/* Bottom: the info pill, and on grid cards the calories at the
            right. Sits above the footer strip when there is one. */}
        <View
          className="absolute left-1 right-2.5 flex-row items-center justify-between"
          style={{ bottom: imageFooter ? 26 : 4 }}
        >
          <MealInfoPill meal={meal} iconOnly={isGrid} />
          {isGrid && (
            <Text className="font-inter-extrabold text-caption text-white">
              {meal.calories} kcal
            </Text>
          )}
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
          {showDescription && !!meal.description && (
            <AppText variant="caption" numberOfLines={2} className="mt-1">
              {meal.description}
            </AppText>
          )}
        </View>

        <View className="mt-2">
          {/* Extra bold, same as the meal page's prices. Plain Text so the
              title variant's own semibold doesn't compete with it. */}
          <Text className="font-inter-extrabold text-subheading text-primary">
            ₱{meal.price}
            {meal.buffer_price ? ` – ₱${meal.buffer_price}` : ""}
          </Text>
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

          {onViewDetails && (
            <View className="mb-4">
              <Button
                label="View Details"
                variant="tinted"
                icon={<ChevronRight color={colors.primary} size={16} />}
                iconPosition="right"
                onPress={onViewDetails}
              />
            </View>
          )}
        </View>
      </View>
    </Pressable>
  );
}
