import { ReactNode, useState } from "react";
import { Pressable, Text, View } from "react-native";
import { router } from "expo-router";
import * as Haptics from "expo-haptics";
import Animated, { FadeIn } from "react-native-reanimated";
import { Plus } from "lucide-react-native";
import { AppText, Carousel } from "@/frontend/components/ui";
import { colors } from "@/frontend/constants/theme";
import { MealCard } from "@/frontend/core/meals/components/card/MealCard";
import { MealCardSkeleton } from "@/frontend/core/meals/components/card/MealCardSkeleton";
import { MealDetailSheet } from "@/frontend/core/meals/components/detail/MealDetailSheet";
import { useFullMeal } from "@/frontend/core/meals/hooks/useFullMeal";
import { mockMeals } from "@/frontend/core/meals/mocks/meals";
import type { MealType } from "@/frontend/core/meals/mealTypes";

const SKELETON_COUNT = 3;
// A meal card's width (MealCard's carousel size), for the Show More card.
const CARD_WIDTH = 250;

// After the visible cards when more are waiting, like the web app's
// suggestions: a card-sized dashed outline with a plus, "Show More Meals".
// The row stretches it to the meal cards' height.
function ShowMoreCard({ onPress }: { onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel="Show more meals"
      style={{ width: CARD_WIDTH }}
      className="flex-1 items-center justify-center gap-3 rounded-2xl border-2 border-dashed border-ink-emphasis/15 active:border-primary active:bg-primary/5"
    >
      <View className="h-11 w-11 items-center justify-center rounded-full bg-ink-emphasis/5">
        <Plus color={colors.ink.subtle} size={22} />
      </View>
      <Text className="font-inter-semibold text-body text-primary">Show More Meals</Text>
    </Pressable>
  );
}

type MealCarouselSectionProps = {
  title: string;
  /** "title" (default): the regular carousel header. "sectionTitle": the big
   *  bold header with an orange dot (e.g. "This week's best value meals"). */
  titleVariant?: "title" | "sectionTitle";
  /** e.g. the trending-down icon on Home's "This week's best value meals". */
  titleIcon?: ReactNode;
  subtitle?: string;
  showSeeAll?: boolean;
  /** See All ends with "Browse all meals" (for a short sample like
   *  Recommendations, where the whole catalog is one step away). */
  seeAllBrowseCta?: boolean;
  /** A chip on See All saying what these meals are, e.g. the picked
   *  category ("Breakfast"). */
  seeAllChip?: string;
  /** See All draws this row's own card instead of MealCard ("bestValue":
   *  BestValueMealCard). */
  seeAllCard?: "bestValue";
  /** Defaults to the full mock catalog — pass a filtered subset (e.g. by category) to narrow it. */
  meals?: MealType[];
  /** Shown as a "Budget: X" chip on the See All screen, when this group came from a budget suggestion. */
  budgetLabel?: string;
  /** With budgetLabel: the servings asked for, so See All shows the meals
   *  priced for them too. */
  servings?: number;
  /** Custom card per meal (e.g. "This week's best value meals"); defaults to
   *  MealCard. `open` shows the meal's detail sheet. */
  renderCard?: (meal: MealType, index: number, open: () => void) => ReactNode;
  /** The custom card's width, so the loading skeletons match it. */
  cardWidth?: number;
  /** Shows MealCardSkeleton placeholders instead of `meals` — for a real
   *  backend fetch still in flight (e.g. Home's Recommendations). Mock-data
   *  callers never need this, since mockMeals is already synchronous. */
  loading?: boolean;
  /** Show this many at first, then a Show More card that adds this many
   *  more each tap. Omitted: every meal at once. */
  pageSize?: number;
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
  seeAllBrowseCta = false,
  seeAllChip,
  seeAllCard,
  meals = mockMeals,
  budgetLabel,
  servings,
  renderCard,
  cardWidth,
  loading = false,
  pageSize,
}: MealCarouselSectionProps) {
  const [visibleCount, setVisibleCount] = useState(pageSize ?? Infinity);
  const visible = meals.slice(0, visibleCount);
  const hasMore = visible.length < meals.length;
  // Where the last "Show More" started, so just the new batch fades in.
  const [batchStart, setBatchStart] = useState<number | null>(null);
  const showMore = () => {
    void Haptics.selectionAsync();
    setBatchStart(visibleCount);
    setVisibleCount((n) => n + (pageSize ?? 0));
  };
  const [selectedMeal, setSelectedMeal] = useState<MealType | null>(null);
  // With its ingredients (and so micronutrients), fetched if the card's
  // meal came from a bulk list.
  const detailMeal = useFullMeal(selectedMeal);

  const handleSeeAll = () => {
    router.push({
      pathname: "/meal-list",
      params: {
        title,
        ids: meals.map((meal) => meal.id ?? "").join(","),
        ...(budgetLabel ? { budget: budgetLabel } : {}),
        ...(servings ? { servings: String(servings) } : {}),
        ...(seeAllBrowseCta ? { browse: "1" } : {}),
        ...(seeAllChip ? { chip: seeAllChip } : {}),
        ...(seeAllCard ? { card: seeAllCard } : {}),
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
          : [
              ...visible.map((meal, i) => {
                const card = renderCard ? (
                  renderCard(meal, i, () => setSelectedMeal(meal))
                ) : (
                  <MealCard meal={meal} onPress={() => setSelectedMeal(meal)} />
                );
                // A new batch from Show More fades in; the rest stay put.
                return batchStart !== null && i >= batchStart ? (
                  <Animated.View key={meal.id} entering={FadeIn.duration(300)}>
                    {card}
                  </Animated.View>
                ) : (
                  <View key={meal.id}>{card}</View>
                );
              }),
              ...(hasMore ? [<ShowMoreCard key="show-more" onPress={showMore} />] : []),
            ]}
      </Carousel>

      <MealDetailSheet meal={detailMeal} onClose={() => setSelectedMeal(null)} />
    </View>
  );
}
