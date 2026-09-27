import { useRecommendedMeals } from "@/frontend/core/meals/hooks/useRecommendedMeals";
import { MealCarouselSection } from "./MealCarouselSection";

// Unlike CommunityFavoritesSection (still mock), this is linked to a random
// sample of 5 real, already-seeded meals — see useRecommendedMeals. Shows
// skeleton cards while the fetch is in flight (not a mock fallback), so it
// never flashes mock content that then gets swapped for real meals.
export function RecommendationsSection() {
  const { meals, isLoading } = useRecommendedMeals();
  return <MealCarouselSection title="Recommendations" meals={meals} loading={isLoading} />;
}
