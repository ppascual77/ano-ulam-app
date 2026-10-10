import { MealCarouselSection } from "@/frontend/core/budget/components/MealCarouselSection";
import { BEST_VALUE_CARD_WIDTH, BestValueMealCard } from "@/frontend/core/prices/components/BestValueMealCard";
import { useBestValueMeals } from "@/frontend/core/prices/hooks/usePriceMeals";

// Thin wrapper over MealCarouselSection (same header/carousel/"See All"/
// detail-sheet plumbing) with BestValueMealCard: what got cheaper and the
// estimated saving. Meals using ingredients whose DA price dropped vs a week
// ago (Home and Price Watch); hidden when there are none.
export function BestValueMealsSection() {
  const { meals, loading } = useBestValueMeals();
  if (!loading && meals.length === 0) return null;
  const byId = new Map(meals.map((m) => [m.meal.id, m]));

  return (
    <MealCarouselSection
      title="This week's best value meals"
      titleVariant="sectionTitle"
      subtitle="Featuring ingredients that cost less this week"
      meals={meals.map((m) => m.meal)}
      cardWidth={BEST_VALUE_CARD_WIDTH}
      renderCard={(meal, index, open) => {
        const value = byId.get(meal.id);
        return value ? <BestValueMealCard value={value} index={index} onPress={open} /> : null;
      }}
      loading={loading}
    />
  );
}
