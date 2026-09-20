import { View, Pressable } from "react-native";
import { ScrollView } from "react-native-gesture-handler";
import { router } from "expo-router";
import { ArrowLeft, ChefHat } from "lucide-react-native";
import { AppText, Button, ErrorState, LoadingState, Screen } from "@/frontend/components/ui";
import { colors } from "@/frontend/constants/theme";
import { useMeals } from "../hooks/useMeals";

export default function ManageMealsScreen() {
  const { data: meals, isLoading, isError } = useMeals({});

  return (
    <Screen padded={false}>
      <View className="px-5 pt-2 pb-4 flex-row items-center gap-2">
        <Pressable onPress={() => router.back()} className="h-9 w-9 items-center justify-center">
          <ArrowLeft color={colors.ink.emphasis} size={18} />
        </Pressable>
        <View className="flex-1">
          <AppText variant="eyebrow">Admin</AppText>
          <AppText variant="heading">Manage Meals</AppText>
          <AppText variant="caption" className="text-ink-subtle">
            {meals?.length ?? 0} meals
          </AppText>
        </View>
      </View>

      <View className="px-5 mb-4">
        <Button label="+ Seed Meal" onPress={() => router.push("/seed-meal")} />
      </View>

      {isLoading ? (
        <LoadingState />
      ) : isError ? (
        <ErrorState />
      ) : (
        <ScrollView className="flex-1 px-5" showsVerticalScrollIndicator={false}>
          {(meals ?? []).map((meal) => (
            <View key={meal.id} className="flex-row items-center gap-3 border-b border-ink-emphasis/10 py-3">
              <View className="w-10 h-10 rounded-full bg-primary/10 items-center justify-center">
                <ChefHat color={colors.primary} size={18} />
              </View>
              <View className="flex-1">
                <AppText variant="bodyBold">{meal.name}</AppText>
                <AppText variant="caption" className="text-ink-subtle">
                  {meal.calories != null ? `${Math.round(meal.calories)} cal` : "No macros yet"}
                  {meal.price != null ? ` · ₱${meal.price.toFixed(0)}` : ""}
                  {!meal.ingredients_synced_at ? " · not synced" : ""}
                </AppText>
              </View>
            </View>
          ))}
        </ScrollView>
      )}
    </Screen>
  );
}
