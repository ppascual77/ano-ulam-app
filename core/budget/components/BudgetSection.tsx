import { useState } from "react";
import { View } from "react-native";
import { BudgetForm } from "./BudgetForm";
import { MealSuggestion } from "./MealSuggestion";
import { CategoriesSection } from "./CategoriesSection";
import { RecommendationsSection } from "./RecommendationsSection";
import { CommunityFavoritesSection } from "./CommunityFavoritesSection";
import { BestValueMealsSection } from "@/core/meals/components/BestValueMealsSection";

// Everything Budget mode shows on Home, as one unit — HomeScreen just
// renders this or PantrySection depending on the toggle, nothing more.
export function BudgetSection() {
  const [suggestion, setSuggestion] = useState<{
    budget: string;
    servings: number;
  } | null>(null);

  return (
    <View className="gap-6 mb-10">
      <BudgetForm onSuggestMeals={setSuggestion} />

      {suggestion ? (
        <MealSuggestion budget={suggestion.budget} />
      ) : (
        <>
          <CategoriesSection />
          <RecommendationsSection />
          <CommunityFavoritesSection />
          <BestValueMealsSection />
        </>
      )}
    </View>
  );
}
