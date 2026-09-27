import { useRecommendedMeals } from "@/frontend/core/meals/hooks/useRecommendedMeals";
import { MealCarouselSection } from "./MealCarouselSection";

// Unlike CommunityFavoritesSection (still mock), this is linked to a random
// sample of 5 real, already-seeded meals — see useRecommendedMeals. Renders
// an empty carousel (not a mock fallback) while loading or if the backend
// has no meals yet, so it never flashes mock content that then gets swapped.
export function RecommendationsSection() {
  const { meals } = useRecommendedMeals();
  return <MealCarouselSection title="Recommendations" meals={meals} />;
}
