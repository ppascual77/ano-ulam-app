import { View } from "react-native";
import { BudgetForm } from "./BudgetForm";
import { CategoriesSection } from "./CategoriesSection";
import { RecommendationsSection } from "./RecommendationsSection";
import { CommunityFavoritesSection } from "./CommunityFavoritesSection";

// Everything Budget mode shows on Home, as one unit — HomeScreen just
// renders this or PantrySection depending on the toggle, nothing more.
export function BudgetSection() {
  return (
    <View className="gap-6">
      <BudgetForm />
      <CategoriesSection />
      <RecommendationsSection />
      <CommunityFavoritesSection />
    </View>
  );
}
