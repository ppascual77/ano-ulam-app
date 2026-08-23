import { ReactNode, useState } from "react";
import { Pressable, View } from "react-native";
import { router } from "expo-router";
import { AppText, Carousel } from "@/components/ui";
import { MealCard } from "@/core/meals/components/card/MealCard";
import { RelatedMealCard } from "@/core/meals/components/detail/RelatedMealCard";
import { MealDetailSheet } from "@/core/meals/components/detail/MealDetailSheet";
import { mockMeals } from "@/core/meals/mocks/meals";
import type { MealType } from "@/core/meals/mealTypes";

const RELATED_CARD_WIDTH = 200;

type MealCarouselSectionProps = {
  title: string;
  /** e.g. the trending-down icon on Home's "This week's best value meals". */
  titleIcon?: ReactNode;
  subtitle?: string;
  showSeeAll?: boolean;
  /** Defaults to the full mock catalog — pass a filtered subset (e.g. by category) to narrow it. */
  meals?: MealType[];
  /** Shown as a "Budget: X" chip on the See All screen, when this group came from a budget suggestion. */
  budgetLabel?: string;
  /** "card" (default): MealCard, full detail. "related": RelatedMealCard,
   *  compact — e.g. Home's "This week's best value meals". */
  cardVariant?: "card" | "related";
  /** Only applies with cardVariant="related" — shows the amber "cheaper this week" note. */
  showValueNote?: boolean;
};

// Shared by RecommendationsSection, CommunityFavoritesSection,
// MealSuggestion's Home-cooked/Fastfood groups, and Home's best-value
// carousel — same layout, different heading/meal list/card.
export function MealCarouselSection({
  title,
  titleIcon,
  subtitle,
  showSeeAll = true,
  meals = mockMeals,
  budgetLabel,
  cardVariant = "card",
  showValueNote = false,
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
      <View className="flex-row items-center justify-between">
        <View className="flex-1 flex-row items-center gap-1.5 pr-2">
          <AppText variant="title">{title}</AppText>
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

      <Carousel>
        {meals.map((meal) =>
          cardVariant === "related" ? (
            <RelatedMealCard
              key={meal.id}
              meal={meal}
              width={RELATED_CARD_WIDTH}
              showValueNote={showValueNote}
              onPress={() => setSelectedMeal(meal)}
            />
          ) : (
            <MealCard key={meal.id} meal={meal} onPress={() => setSelectedMeal(meal)} />
          ),
        )}
      </Carousel>

      <MealDetailSheet meal={selectedMeal} onClose={() => setSelectedMeal(null)} />
    </View>
  );
}
