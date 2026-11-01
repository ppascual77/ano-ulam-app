import { useMemo, useState } from "react";
import {
  Pressable,
  ScrollView,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import Animated, { FadeIn, FadeInDown, FadeOut, LinearTransition } from "react-native-reanimated";
import { useReduceMotion } from "@/frontend/core/preferences/store/useReduceMotionStore";
import { ArrowLeft } from "lucide-react-native";
import { AppText, Button, Screen } from "@/frontend/components/ui";
import { colors } from "@/frontend/constants/theme";
import { BottomNav } from "@/frontend/components/navigation/BottomNav";
import { MealCard } from "@/frontend/core/meals/components/card/MealCard";
import { BestValueMealCard } from "@/frontend/core/prices/components/BestValueMealCard";
import { useBestValueMeals } from "@/frontend/core/prices/hooks/usePriceMeals";
import { MealDetailSheet } from "@/frontend/core/meals/components/detail/MealDetailSheet";
import { useFullMeal } from "@/frontend/core/meals/hooks/useFullMeal";
import { useRealMeals } from "@/frontend/core/meals/hooks/useRealMeals";
import type { MealType } from "@/frontend/core/meals/mealTypes";
import { scaleMeal } from "@/frontend/core/meals/utils/scaleMeal";
import { QuickFilters, passesQuickFilter } from "@/frontend/core/budget/components/QuickFilters";

const SCREEN_PADDING = 28 * 2; // matches Screen's px-7
const COLUMN_GAP = 12;

export default function MealListScreen() {
  const { title, ids, budget, servings: servingsParam, card } = useLocalSearchParams<{
    title: string;
    ids: string;
    budget?: string;
    /** From a budget suggestion: show the meals priced for these servings. */
    servings?: string;
    /** "bestValue": the same card as Home's best value row. */
    card?: string;
  }>();
  // This week's best value meals: their own card (what got cheaper, the
  // saving), from the same data as the row, and no Quick Filters (a short,
  // already-focused list).
  const showFilters = card !== "bestValue";
  const { meals: bestValue } = useBestValueMeals();
  const bestValueById = useMemo(
    () => (card === "bestValue" ? new Map(bestValue.map((value) => [value.meal.id, value])) : null),
    [card, bestValue],
  );
  const servings = servingsParam ? Number(servingsParam) : null;
  const [filters, setFilters] = useState<string[]>([]);
  const { width: screenWidth } = useWindowDimensions();
  const [selectedMeal, setSelectedMeal] = useState<MealType | null>(null);
  // With its ingredients (and so micronutrients): these come from a bulk
  // list without them.
  const detailMeal = useFullMeal(selectedMeal);
  // The row's meal ids, looked up in the real catalog (the bulk list).
  const { data: realMeals } = useRealMeals();

  // In the order passed (a budget suggestion's: closest to the budget
  // first), priced for the suggestion's servings when it came from one.
  const meals = useMemo(() => {
    const pool = new Map((realMeals ?? []).map((meal) => [meal.id, meal]));
    return (ids ?? "")
      .split(",")
      .filter(Boolean)
      .flatMap((id) => {
        const meal = pool.get(id);
        if (!meal) return [];
        return [servings ? scaleMeal(meal, servings) : meal];
      });
  }, [ids, realMeals, servings]);

  // Quick Filters live here (not on Home's suggestion rows), checked per
  // serving. Any chip matches (Chicken + Pork: chicken or pork meals); none
  // picked shows everything.
  const shown = useMemo(
    () =>
      filters.length === 0
        ? meals
        : meals.filter((meal) => filters.some((filterId) => passesQuickFilter(scaleMeal(meal, 1), filterId))),
    [meals, filters],
  );

  const cardWidth = (screenWidth - SCREEN_PADDING - COLUMN_GAP) / 2;

  // Filtering, quick so it never feels slow: cards that come in slide up a
  // little and fade in, cards that stay glide to their new spot, cards that
  // go fade out. Reduce motion: fades only, no sliding.
  const reduceMotion = useReduceMotion();
  const cardIn = reduceMotion ? FadeIn.duration(150) : FadeInDown.duration(200);
  const cardOut = FadeOut.duration(120);
  const cardMove = reduceMotion ? undefined : LinearTransition.duration(200);

  // Top edge only, no padding: the content pads itself, and BottomNav sits
  // outside it, full width, owning the bottom safe area (like the tab bar).
  return (
    <Screen edges={["top"]} padded={false} dismissKeyboardOnTap={false}>
      <View className="flex-1 px-7 pt-2">
        <View className="mt-2 flex-row items-center gap-2">
          <Pressable
            onPress={() => router.back()}
            className="h-9 w-9 items-center justify-center"
          >
            <ArrowLeft color={colors.ink.emphasis} size={18} />
          </Pressable>
          <AppText variant="title">{title}</AppText>
        </View>
        <AppText variant="caption" className="ml-11">
          {shown.length} {shown.length === 1 ? "meal" : "meals"} found
        </AppText>

        {/* Everything below the title scrolls with the meals (nothing
            sticks): the budget pill, Quick Filters, the grid. */}
        <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
          {budget && (
            <View className="mt-5 self-start rounded-full border border-primary px-3 py-1.5">
              <Text className="font-inter-semibold text-caption text-primary">
                Budget: ₱{budget}
                {servings ? ` · ${servings} ${servings === 1 ? "serving" : "servings"}` : ""}
              </Text>
            </View>
          )}

          {showFilters ? (
            <View className="mb-4 mt-5">
              <QuickFilters selected={filters} onChange={setFilters} />
            </View>
          ) : (
            <View className="h-4" />
          )}
          {shown.length === 0 && meals.length > 0 && (
            <View className="items-center gap-4 px-4 py-12">
              <View className="items-center">
                <AppText variant="sectionSubtitle" dot className="text-center">
                  No meals match these filters
                </AppText>
                <Text className="mt-1 text-center font-inter-regular text-body text-ink-subtle">
                  Try other filters, or clear them to see every meal.
                </Text>
              </View>
              <View className="self-stretch">
                <Button label="Clear filters" variant="outline" onPress={() => setFilters([])} />
              </View>
            </View>
          )}
          <View className="flex-row flex-wrap justify-between gap-y-4">
            {shown.map((meal, i) => {
              const value = bestValueById?.get(meal.id);
              return (
                <Animated.View key={meal.id} entering={cardIn} exiting={cardOut} layout={cardMove}>
                  {value ? (
                    // Stagger capped: in a long grid, lower cards shouldn't
                    // wait seconds for their entrance.
                    <BestValueMealCard value={value} index={Math.min(i, 5)} width={cardWidth} onPress={() => setSelectedMeal(meal)} />
                  ) : (
                    <MealCard meal={meal} width={cardWidth} layout="grid" onPress={() => setSelectedMeal(meal)} />
                  )}
                </Animated.View>
              );
            })}
          </View>
        </ScrollView>

      </View>

      <MealDetailSheet
        meal={detailMeal}
        onClose={() => setSelectedMeal(null)}
      />
      <BottomNav />
    </Screen>
  );
}
