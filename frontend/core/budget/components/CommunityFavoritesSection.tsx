import { useMemo } from "react";
import { usePreferredMeals } from "@/frontend/core/meals/hooks/usePreferredMeals";
import { useMealLikes } from "@/frontend/core/likes/hooks/useMealLikes";
import { MealCarouselSection } from "./MealCarouselSection";

const TOP_COUNT = 10;

// Home's Community Favorites: the most-liked real meals (meal_likes /
// like_count), following preferences. Counts come from useMealLikes, so
// your own fresh likes count right away. Only meals with at least one
// like: with none yet, the section stays hidden rather than calling random
// meals favorites. Top 10, shown 5 at a time.
export function CommunityFavoritesSection() {
  const { meals, isLoading } = usePreferredMeals();
  const { likeOf } = useMealLikes();
  const favorites = useMemo(
    () =>
      meals
        .map((meal) => ({ meal, count: likeOf(meal).count }))
        .filter((entry) => entry.count > 0)
        .sort((a, b) => b.count - a.count)
        .slice(0, TOP_COUNT)
        .map((entry) => entry.meal),
    [meals, likeOf],
  );

  if (!isLoading && favorites.length === 0) return null;
  return (
    <MealCarouselSection
      title="Community Favorites"
      titleVariant="sectionTitle"
      subtitle="The meals people like most"
      showSeeAll={false}
      meals={favorites}
      loading={isLoading}
      pageSize={5}
    />
  );
}
