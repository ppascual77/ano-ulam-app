import { useRecommendedMeals } from "@/frontend/core/meals/hooks/useRecommendedMeals";
import { MealCarouselSection } from "./MealCarouselSection";
import { CATEGORY_LABELS, CATEGORY_NOUNS, type CategoryId } from "../utils/categories";

// Unlike CommunityFavoritesSection (still mock), this is linked to real,
// already-seeded meals (see useRecommendedMeals): 10 random picks, or with a
// Categories tile picked (`category`), every meal in that category. Shown 5
// at a time with a Show More card; See All then carries the category as a
// chip. Shows skeleton cards while the fetch is in flight (not a mock
// fallback), so it never flashes mock content that then gets swapped for
// real meals.
export function RecommendationsSection({ category = null }: { category?: CategoryId | null }) {
  const { meals, isLoading } = useRecommendedMeals(category);
  return (
    <MealCarouselSection
      // A new category starts again from its first 5.
      key={category ?? "all"}
      title="Recommendations"
      titleVariant="sectionTitle"
      subtitle={
        isLoading || meals.length > 0
          ? undefined
          : category
            ? `No ${CATEGORY_NOUNS[category]} meals match your preferences yet.`
            : "No meals match your preferences yet."
      }
      showSeeAll={meals.length > 0}
      meals={meals}
      loading={isLoading}
      pageSize={5}
      seeAllBrowseCta
      seeAllChip={category ? CATEGORY_LABELS[category] : undefined}
    />
  );
}
