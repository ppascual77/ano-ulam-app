import { useState } from "react";
import { ScrollView, View } from "react-native";
import { Filter } from "lucide-react-native";
import { AppText, Avatar, Button, Screen, SearchBar } from "@/frontend/components/ui";
import { colors } from "@/frontend/constants/theme";
import { CravingTagline } from "@/frontend/features/browse/components/CravingTagline";
import { MoodSelection } from "@/frontend/features/browse/components/MoodSelection";
import { TodaysPickCard } from "@/frontend/core/meals/components/card/TodaysPickCard";
import { MealDetailSheet } from "@/frontend/core/meals/components/detail/MealDetailSheet";
import { mockMeals } from "@/frontend/core/meals/mocks/meals";
import type { MealType } from "@/frontend/core/meals/mealTypes";

const todaysPick = mockMeals.find((meal) => meal.normalized_name === "bananaandpeanutbutter");

export default function BrowseScreen() {
  const [selectedMeal, setSelectedMeal] = useState<MealType | null>(null);

  return (
    <Screen edges={["top"]}>
      <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
        <AppText variant="title" className="ml-3 mt-3">
          What are you craving today?
        </AppText>

        <View className="ml-3">
          <CravingTagline />
        </View>

        <View className="mt-3 flex-row items-center gap-3">
          <SearchBar className="flex-1" />
          <Button
            icon={<Filter color={colors.ink.subtle} size={18} />}
            variant="muted"
            shape="circle"
          />
        </View>

        {todaysPick && (
          <View className="mt-6 mb-6">
            <AppText variant="title" className="mb-3">
              Today&apos;s pick
            </AppText>
            <TodaysPickCard meal={todaysPick} onPress={() => setSelectedMeal(todaysPick)} />
          </View>
        )}

        <View className="mb-6">
          <MoodSelection onSelectMeal={setSelectedMeal} />
        </View>
      </ScrollView>

      <MealDetailSheet meal={selectedMeal} onClose={() => setSelectedMeal(null)} />
    </Screen>
  );
}
