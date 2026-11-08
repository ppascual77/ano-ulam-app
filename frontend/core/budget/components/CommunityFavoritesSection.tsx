import { useMemo, useState } from "react";
import { Pressable, Text, View } from "react-native";
import Animated, { Easing, FadeIn, FadeInDown } from "react-native-reanimated";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { Bookmark } from "lucide-react-native";
import { AppText } from "@/frontend/components/ui";
import { colors } from "@/frontend/constants/theme";
import { MealDetailSheet } from "@/frontend/core/meals/components/detail/MealDetailSheet";
import { useFullMeal } from "@/frontend/core/meals/hooks/useFullMeal";
import { useLiveSaveCount } from "@/frontend/core/meals/hooks/useLiveSaveCount";
import { usePreferredMeals } from "@/frontend/core/meals/hooks/usePreferredMeals";
import { resolveMealImage } from "@/frontend/core/meals/resolveMealImage";
import type { MealType } from "@/frontend/core/meals/mealTypes";
import { useReduceMotion } from "@/frontend/core/preferences/store/useReduceMotionStore";

const TOP_COUNT = 5;
const GAP = 6;
// The spread's heights: the wide hero, the tall card (its small partners
// split it in two, less a gap), and the full-width closer.
const HERO_HEIGHT = 200;
const TALL_HEIGHT = 250;
const CLOSER_HEIGHT = 170;
const EASE = Easing.out(Easing.cubic);
// Over the photos: clear at the top, dark at the bottom so white text reads.
const PHOTO_SHADE = ["rgba(0,0,0,0)", "rgba(0,0,0,0.05)", "rgba(0,0,0,0.72)"] as const;

type Variant = "hero" | "tall" | "small" | "closer";

const rank = (i: number) => String(i + 1).padStart(2, "0");
const priceOf = (meal: MealType) => `₱${meal.price}${meal.buffer_price ? `–${meal.buffer_price}` : ""}`;

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

// A photo tile: the meal's photo, a dark fade, the rank top left and the
// saves top right, the name and price over the photo at the bottom.
function PhotoTile({ meal, index, variant, height, onPress }: { meal: MealType; index: number; variant: Exclude<Variant, "row">; height: number; onPress: () => void }) {
  const big = variant === "hero";
  const small = variant === "small";
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`Number ${index + 1}, ${meal.name}, ${priceOf(meal)}`}
      style={{ height }}
      className="overflow-hidden rounded-2xl bg-ink-emphasis/5 active:opacity-90"
    >
      <Image source={resolveMealImage(meal)} style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }} contentFit="cover" transition={250} />
      <LinearGradient colors={PHOTO_SHADE} locations={[0, 0.4, 1]} style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }} />

      <View className={`absolute flex-row items-start justify-between ${small ? "left-3 right-2.5 top-2.5" : "left-4 right-3 top-3"}`}>
        <Text className={`font-inter-extrabold tracking-display text-white ${big ? "text-heading" : "text-subheading"}`}>
          {rank(index)}
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
        {!small && <Text className="mt-1 font-inter-bold text-small text-white">{priceOf(meal)}</Text>}
      </View>
    </Pressable>
  );
}

// Grey blocks in the spread's shapes while it loads, so nothing jumps.
function SpreadSkeleton() {
  const block = "rounded-2xl bg-ink-emphasis/5";
  return (
    <View style={{ gap: GAP }}>
      <View style={{ height: HERO_HEIGHT }} className={block} />
      <View className="flex-row" style={{ gap: GAP }}>
        <View style={{ height: TALL_HEIGHT }} className={`flex-1 ${block}`} />
        <View className="flex-1" style={{ gap: GAP }}>
          <View className={`flex-1 ${block}`} />
          <View className={`flex-1 ${block}`} />
        </View>
      </View>
      <View style={{ height: CLOSER_HEIGHT }} className={block} />
    </View>
  );
}

// Home's Community Favorites: the 5 most-saved real meals (meals.save_count,
// kept by the database from saved_meals: saving means "I'll cook this"),
// following preferences, laid out flat as one magazine spread: #1 as a wide
// hero, #2 a tall portrait card with #3 and #4 stacked beside it, #5 a
// full-width photo (shorter than the hero) to close. Ranks in big numerals with the accent dot, the
// saves as a pill at each tile's top right. Only meals
// someone saved: with none yet, the section stays hidden rather than calling
// random meals favorites. Fewer than 5 still lay out (the spread just ends
// earlier).
export function CommunityFavoritesSection() {
  const reduceMotion = useReduceMotion();
  const { meals, isLoading } = usePreferredMeals();
  const favorites = useMemo(
    () =>
      meals
        .filter((meal) => (meal.save_count ?? 0) > 0)
        .sort((a, b) => (b.save_count ?? 0) - (a.save_count ?? 0))
        .slice(0, TOP_COUNT),
    [meals],
  );
  const [selected, setSelected] = useState<MealType | null>(null);
  // With its ingredients (and so micronutrients), fetched if needed.
  const detailMeal = useFullMeal(selected);

  if (!isLoading && favorites.length === 0) return null;

  const [first, second, third, fourth, fifth] = favorites;
  const smallHeight = (TALL_HEIGHT - GAP) / 2;
  // Each block rises in turn as the spread appears.
  const enter = (i: number) => (reduceMotion ? FadeIn.duration(200) : FadeInDown.delay(i * 70).duration(360).easing(EASE));
  const open = (meal: MealType) => () => setSelected(meal);

  return (
    <View className="gap-3">
      <View>
        <AppText variant="sectionTitle" dot>
          Community Favorites
        </AppText>
        <AppText variant="caption">The meals people save most</AppText>
      </View>

      {isLoading ? (
        <SpreadSkeleton />
      ) : (
        <View style={{ gap: GAP }}>
          {first && (
            <Animated.View entering={enter(0)}>
              <PhotoTile meal={first} index={0} variant="hero" height={HERO_HEIGHT} onPress={open(first)} />
            </Animated.View>
          )}

          {second && (
            <View className="flex-row" style={{ gap: GAP }}>
              <Animated.View entering={enter(1)} style={{ flex: 1 }}>
                <PhotoTile meal={second} index={1} variant="tall" height={third ? TALL_HEIGHT : smallHeight} onPress={open(second)} />
              </Animated.View>
              {third && (
                <View style={{ flex: 1, gap: GAP }}>
                  <Animated.View entering={enter(2)}>
                    <PhotoTile meal={third} index={2} variant="small" height={fourth ? smallHeight : TALL_HEIGHT} onPress={open(third)} />
                  </Animated.View>
                  {fourth && (
                    <Animated.View entering={enter(3)}>
                      <PhotoTile meal={fourth} index={3} variant="small" height={smallHeight} onPress={open(fourth)} />
                    </Animated.View>
                  )}
                </View>
              )}
            </View>
          )}

          {fifth && (
            <Animated.View entering={enter(4)}>
              <PhotoTile meal={fifth} index={4} variant="closer" height={CLOSER_HEIGHT} onPress={open(fifth)} />
            </Animated.View>
          )}
        </View>
      )}

      <MealDetailSheet meal={detailMeal} onClose={() => setSelected(null)} />
    </View>
  );
}
