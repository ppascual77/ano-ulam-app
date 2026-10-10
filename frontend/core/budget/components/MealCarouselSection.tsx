import { ReactNode, useState } from "react";
import { Pressable, View } from "react-native";
import { router } from "expo-router";
import { AppText, Carousel } from "@/frontend/components/ui";
import { MealCard } from "@/frontend/core/meals/components/card/MealCard";
import { MealCardSkeleton } from "@/frontend/core/meals/components/card/MealCardSkeleton";
import { MealDetailSheet } from "@/frontend/core/meals/components/detail/MealDetailSheet";
import { mockMeals } from "@/frontend/core/meals/mocks/meals";
import type { MealType } from "@/frontend/core/meals/mealTypes";

const SKELETON_COUNT = 3;

type MealCarouselSectionProps = {
  title: string;
  /** "title" (default): the regular carousel header. "sectionTitle": the big
   *  bold header with an orange dot (e.g. "This week's best value meals"). */
  titleVariant?: "title" | "sectionTitle";
  /** e.g. the trending-down icon on Home's "This week's best value meals". */
  titleIcon?: ReactNode;
  subtitle?: string;
  showSeeAll?: boolean;
  /** Defaults to the full mock catalog — pass a filtered subset (e.g. by category) to narrow it. */
  meals?: MealType[];
  /** Shown as a "Budget: X" chip on the See All screen, when this group came from a budget suggestion. */
  budgetLabel?: string;
  /** Custom card per meal (e.g. "This week's best value meals"); defaults to
   *  MealCard. `open` shows the meal's detail sheet. */
  renderCard?: (meal: MealType, index: number, open: () => void) => ReactNode;
  /** The custom card's width, so the loading skeletons match it. */
  cardWidth?: number;
  /** Shows MealCardSkeleton placeholders instead of `meals` — for a real
   *  backend fetch still in flight (e.g. Home's Recommendations). Mock-data
   *  callers never need this, since mockMeals is already synchronous. */
  loading?: boolean;
};

// Shared by RecommendationsSection, CommunityFavoritesSection,
// MealSuggestion's Home-cooked/Fastfood groups, and Home's best-value
// carousel — same layout, different heading/meal list/card.
export function MealCarouselSection({
  title,
  titleVariant = "title",
  titleIcon,
  subtitle,
  showSeeAll = true,
  meals = mockMeals,
  budgetLabel,
  renderCard,
  cardWidth,
  loading = false,
}: MealCarouselSectionProps) {
  const [selectedMeal, setSelectedMeal] = useState<MealType | null>(null);

  const handleSeeAll = () => {
    router.push({
      pathname: "/meal-list",
      params: {
        title,
        ids: meals.map((meal) => meal.id ?? "").join(","),
        ...(budgetLabel ? { budget: budgetLabel } : {}),
      },
    });
  };

  return (
    <View className="gap-3">
      {/* Title and subtitle grouped, so the subtitle sits right under the
          title instead of getting the section's gap-3. */}
      <View>
        <View className="flex-row items-center justify-between">
          <View className="flex-1 flex-row items-center gap-1.5 pr-2">
            <AppText variant={titleVariant} dot={titleVariant === "sectionTitle"}>
              {title}
            </AppText>
            {titleIcon}
          </View>
          {showSeeAll && (
            <Pressable onPress={handleSeeAll}>
              <AppText variant="bodyMedium" className="text-primary">
                See All
              </AppText>
            </Pressable>
          )}
        </View>
        {subtitle && <AppText variant="caption">{subtitle}</AppText>}
      </View>

      <Carousel>
        {loading
          ? Array.from({ length: SKELETON_COUNT }).map((_, i) => <MealCardSkeleton key={i} width={cardWidth} />)
          : meals.map((meal, i) =>
              renderCard ? (
                <View key={meal.id}>{renderCard(meal, i, () => setSelectedMeal(meal))}</View>
              ) : (
                <MealCard key={meal.id} meal={meal} onPress={() => setSelectedMeal(meal)} />
              ),
            )}
      </Carousel>

      <MealDetailSheet meal={selectedMeal} onClose={() => setSelectedMeal(null)} />
    </View>
  );
}
