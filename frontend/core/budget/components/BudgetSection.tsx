import { type RefObject, useState } from "react";
import { View } from "react-native";
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
  categoriesDotRef?: RefObject<View | null>;
  showCategoriesDot?: boolean;
};

export function BudgetSection({ categoriesDotRef, showCategoriesDot }: BudgetSectionProps) {
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
          <CategoriesSection dotRef={categoriesDotRef} showDot={showCategoriesDot} />
          <RecommendationsSection />
          <CommunityFavoritesSection />
          <BestValueMealsSection />
        </>
      )}
    </View>
  );
}
