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
import { MealDetailSheet } from "@/frontend/core/meals/components/detail/MealDetailSheet";
import { mockMeals } from "@/frontend/core/meals/mocks/meals";
import type { MealType } from "@/frontend/core/meals/mealTypes";

const SCREEN_PADDING = 28 * 2; // matches Screen's px-7
const COLUMN_GAP = 12;

export default function MealListScreen() {
  const { title, ids, budget } = useLocalSearchParams<{
    title: string;
    ids: string;
    budget?: string;
  }>();
  const { width: screenWidth } = useWindowDimensions();
  const [selectedMeal, setSelectedMeal] = useState<MealType | null>(null);

  const meals = useMemo(() => {
    const idSet = new Set((ids ?? "").split(",").filter(Boolean));
    return mockMeals.filter((meal) => meal.id && idSet.has(meal.id));
  }, [ids]);

  const cardWidth = (screenWidth - SCREEN_PADDING - COLUMN_GAP) / 2;

  return (
    <Screen>
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

      {budget && (
        <View className="mt-5 self-start rounded-full border border-primary px-3 py-1.5">
          <Text className="font-inter-semibold text-caption text-primary">
            Budget: {budget}
          </Text>
        </View>
      )}

      <ScrollView className="mt-4 flex-1" showsVerticalScrollIndicator={false}>
        <View className="flex-row flex-wrap justify-between gap-y-4">
          {meals.map((meal) => (
            <MealCard
              key={meal.id}
              meal={meal}
              width={cardWidth}
              layout="grid"
              onPress={() => setSelectedMeal(meal)}
            />
          ))}
        </View>
      </ScrollView>

      <MealDetailSheet
        meal={selectedMeal}
        onClose={() => setSelectedMeal(null)}
      />
      <BottomNav />
    </Screen>
  );
}
