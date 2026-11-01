import { useMemo } from "react";
import { useRecommendedMeals } from "@/frontend/core/meals/hooks/useRecommendedMeals";
import { scaleMeal } from "@/frontend/core/meals/utils/scaleMeal";
import { MealCarouselSection } from "./MealCarouselSection";
import { CATEGORY_NOUNS, type CategoryId } from "../utils/categories";
import { DEFAULT_SERVINGS } from "../utils/budgetMatch";

// Unlike CommunityFavoritesSection (still mock), this is linked to real,
// already-seeded meals (see useRecommendedMeals): 10 random picks, or with a
// Categories tile picked (`category`), every meal in that category. Shown 5
// at a time with a Show More card, and no See All (the Show More card is the
// way through them; Browse is the way to everything). Shows skeleton cards while the fetch is in flight (not a mock
// fallback), so it never flashes mock content that then gets swapped for
// real meals.
export function RecommendationsSection({
  category = null,
  switching = false,
}: {
  category?: CategoryId | null;
  /** A category switch still being prepared: skeletons meanwhile. */
  switching?: boolean;
}) {
  const { meals: recipes, isLoading } = useRecommendedMeals(category);
  // Priced and portioned for DEFAULT_SERVINGS, like the budget suggestions:
  // the card's price is for 2, and the detail sheet opens at 2 (useFullMeal
  // re-scales the full meal to this serving_size).
  const meals = useMemo(() => recipes.map((meal) => scaleMeal(meal, DEFAULT_SERVINGS)), [recipes]);
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
      showSeeAll={false}
      meals={meals}
      loading={isLoading || switching}
      pageSize={5}
    />
  );
}
