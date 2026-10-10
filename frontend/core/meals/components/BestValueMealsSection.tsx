import { MealCarouselSection } from "@/frontend/core/budget/components/MealCarouselSection";
import { useBestValueMeals } from "@/frontend/core/prices/hooks/usePriceMeals";

// Thin wrapper over MealCarouselSection (same header/carousel/"See All"/
// detail-sheet plumbing), pointed at RelatedMealCard's compact "value note"
// variant instead of the full MealCard. Meals using ingredients whose DA
// price dropped vs a week ago (Home and Price Watch); hidden when there
// are none.
export function BestValueMealsSection() {
  const { meals, loading } = useBestValueMeals();
  if (!loading && meals.length === 0) return null;

  return (
    <MealCarouselSection
      title="This week's best value meals"
      titleVariant="sectionTitle"
      subtitle="Featuring ingredients that cost less this week"
      cardVariant="related"
      showValueNote
      meals={meals}
      loading={loading}
    />
  );
}
