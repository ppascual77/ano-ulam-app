import { useMemo, useState } from "react";
import {
  Pressable,
  ScrollView,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { ArrowLeft } from "lucide-react-native";
import { AppText, Screen } from "@/frontend/components/ui";
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
  // saving), from the same data as the row.
  const { meals: bestValue } = useBestValueMeals();
  const bestValueById = useMemo(
    () => (card === "bestValue" ? new Map(bestValue.map((value) => [value.meal.id, value])) : null),
    [card, bestValue],
  );
  const servings = servingsParam ? Number(servingsParam) : null;
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

  const cardWidth = (screenWidth - SCREEN_PADDING - COLUMN_GAP) / 2;

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
          {meals.length} {meals.length === 1 ? "meal" : "meals"} found
        </AppText>

        {/* Everything below the title scrolls with the meals (nothing
            sticks): the budget pill, the grid. */}
        <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
          {budget && (
            <View className="mt-5 self-start rounded-full border border-primary px-3 py-1.5">
              <Text className="font-inter-semibold text-caption text-primary">
                Budget: ₱{budget}
                {servings ? ` · ${servings} ${servings === 1 ? "serving" : "servings"}` : ""}
              </Text>
            </View>
          )}

          <View className="h-4" />
          <View className="flex-row flex-wrap justify-between gap-y-4">
            {meals.map((meal, i) => {
              const value = bestValueById?.get(meal.id);
              return (
                <View key={meal.id}>
                  {value ? (
                    // Stagger capped: in a long grid, lower cards shouldn't
                    // wait seconds for their entrance.
                    <BestValueMealCard value={value} index={Math.min(i, 5)} width={cardWidth} onPress={() => setSelectedMeal(meal)} />
                  ) : (
                    <MealCard meal={meal} width={cardWidth} layout="grid" onPress={() => setSelectedMeal(meal)} />
                  )}
                </View>
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
