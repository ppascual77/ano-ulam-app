import { useMemo, useState } from "react";
import { View } from "react-native";
import Animated, { Easing, FadeIn, FadeInDown } from "react-native-reanimated";
import { AppText } from "@/frontend/components/ui";
import { MealPhotoTile, mealPriceLabel, type MealPhotoTileSize } from "@/frontend/core/meals/components/card/MealPhotoTile";
import { MealDetailSheet } from "@/frontend/core/meals/components/detail/MealDetailSheet";
import { useFullMeal } from "@/frontend/core/meals/hooks/useFullMeal";
import { usePreferredMeals } from "@/frontend/core/meals/hooks/usePreferredMeals";
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

type Variant = "hero" | "tall" | "small" | "closer";

const rank = (i: number) => String(i + 1).padStart(2, "0");
const TILE_SIZE: Record<Variant, MealPhotoTileSize> = { hero: "large", tall: "medium", small: "small", closer: "medium" };

// A spread tile: the shared photo tile with the meal's rank as its stat.
function PhotoTile({ meal, index, variant, height, onPress }: { meal: MealType; index: number; variant: Variant; height: number; onPress: () => void }) {
  return (
    <MealPhotoTile
      meal={meal}
      size={TILE_SIZE[variant]}
      height={height}
      stat={rank(index)}
      onPress={onPress}
      accessibilityLabel={`Number ${index + 1}, ${meal.name}, ${mealPriceLabel(meal)}`}
    />
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
