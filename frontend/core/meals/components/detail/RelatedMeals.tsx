import { View } from "react-native";
import { AppText } from "@/frontend/components/ui";
import { RelatedMealCard } from "./RelatedMealCard";
import { mockMeals } from "../../mocks/meals";
import type { MealType } from "../../mealTypes";

type RelatedMealsProps = {
  meal: MealType;
  onSelectMeal?: (meal: MealType) => void;
};

// No backend yet — "related" just means the rest of the mock catalog,
// excluding whichever meal is currently open.
export function RelatedMeals({ meal, onSelectMeal }: RelatedMealsProps) {
  const related = mockMeals.filter((m) => m.id !== meal.id);
  if (related.length === 0) return null;

  return (
    <View className="mt-6">
      <AppText variant="title">Related meals</AppText>
      <View className="mt-3 flex-row flex-wrap gap-3 mx-1">
        {related.map((m) => (
          <RelatedMealCard key={m.id} meal={m} onPress={() => onSelectMeal?.(m)} />
        ))}
      </View>
    </View>
  );
}
