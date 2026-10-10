import { useState } from "react";
import { View } from "react-native";
import type { LandingDot } from "@/frontend/components/ui";
import { BudgetForm } from "./BudgetForm";
import { MealSuggestion } from "./MealSuggestion";
import { CategoriesSection } from "./CategoriesSection";
import { RecommendationsSection } from "./RecommendationsSection";
import { CommunityFavoritesSection } from "./CommunityFavoritesSection";
import { BestValueMealsSection } from "@/frontend/core/meals/components/BestValueMealsSection";

// Everything Budget mode shows on Home, as one unit — HomeScreen just
// renders this or PantrySection depending on the toggle, nothing more.
type BudgetSectionProps = {
  /** Passed to the "Categories." title (see CategoriesSection). */
  categoriesLanding?: LandingDot;
};

export function BudgetSection({ categoriesLanding }: BudgetSectionProps) {
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
          <CategoriesSection landing={categoriesLanding} />
          <RecommendationsSection />
          <CommunityFavoritesSection />
          <BestValueMealsSection />
        </>
      )}
    </View>
  );
}
