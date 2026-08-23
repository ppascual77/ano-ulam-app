import { TrendingDown } from "lucide-react-native";
import { colors } from "@/constants/theme";
import { MealCarouselSection } from "@/core/budget/components/MealCarouselSection";

// Thin wrapper over MealCarouselSection (same header/carousel/"See All"/
// detail-sheet plumbing), pointed at RelatedMealCard's compact "value note"
// variant instead of the full MealCard.
export function BestValueMealsSection() {
  return (
    <MealCarouselSection
      title="This week's best value meals"
      titleIcon={<TrendingDown color={colors.notice.icon} size={16} />}
      subtitle="Featuring ingredients that cost less this week"
      cardVariant="related"
      showValueNote
    />
  );
}
