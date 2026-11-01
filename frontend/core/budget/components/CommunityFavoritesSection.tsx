import { useMemo } from "react";
import { usePreferredMeals } from "@/frontend/core/meals/hooks/usePreferredMeals";
import { MealCarouselSection } from "./MealCarouselSection";

const TOP_COUNT = 10;

// Home's Community Favorites: the most-saved real meals (meals.save_count,
// kept by the database from saved_meals: saving means "I'll cook this"),
// following preferences. Only meals someone saved: with none yet, the
// section stays hidden rather than calling random meals favorites. Top 10,
// shown 5 at a time.
export function CommunityFavoritesSection() {
  const { meals, isLoading } = usePreferredMeals();
  const favorites = useMemo(
    () =>
      meals
        .filter((meal) => (meal.save_count ?? 0) > 0)
        .sort((a, b) => (b.save_count ?? 0) - (a.save_count ?? 0))
        .slice(0, TOP_COUNT),
    [meals],
  );

  if (!isLoading && favorites.length === 0) return null;
  return (
    <MealCarouselSection
      title="Community Favorites"
      titleVariant="sectionTitle"
      subtitle="The meals people save most"
      showSeeAll={false}
      meals={favorites}
      loading={isLoading}
      pageSize={5}
    />
  );
}
