import { ReactNode, useState } from "react";
import { Pressable, Text, View } from "react-native";
import { router } from "expo-router";
import * as Haptics from "expo-haptics";
import Animated, { FadeIn, FadeOut } from "react-native-reanimated";
import { Plus } from "lucide-react-native";
import { AppText, Carousel } from "@/frontend/components/ui";
import { colors } from "@/frontend/constants/theme";
import { MealCard } from "@/frontend/core/meals/components/card/MealCard";
import { MealCardSkeleton } from "@/frontend/core/meals/components/card/MealCardSkeleton";
import { MealDetailSheet } from "@/frontend/core/meals/components/detail/MealDetailSheet";
import { useFullMeal } from "@/frontend/core/meals/hooks/useFullMeal";
import type { MealType } from "@/frontend/core/meals/mealTypes";
import { SeeAllMatchesCard } from "@/frontend/core/pro/components/SeeAllMatchesCard";
import { FREE_RESULTS_CAP } from "@/frontend/core/pro/proContent";
import { useIsPro } from "@/frontend/core/pro/store/useProStore";

const SKELETON_COUNT = 3;
// Skeleton -> cards: a fast crossfade, the skeletons out as the cards come in.
const SKELETON_OUT = FadeOut.duration(120);
const CARD_IN = FadeIn.duration(150);
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
  /** See All draws this row's own card instead of MealCard ("bestValue":
   *  BestValueMealCard). */
  seeAllCard?: "bestValue";
  meals: MealType[];
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
  /** Shows MealCardSkeleton placeholders instead of `meals`, while they're
   *  still loading (e.g. Home's Recommendations). */
  loading?: boolean;
  /** Show this many at first, then a Show More card that adds this many
   *  more each tap. Omitted: every meal at once. */
  pageSize?: number;
  /** Search results (Suggest by Budget): a free account sees only the first
   *  FREE_RESULTS_CAP, then a "See every match with Pro" card where Show
   *  More would be; See All lists the same capped set. */
  capForFree?: boolean;
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
  seeAllCard,
  meals,
  budgetLabel,
  servings,
  renderCard,
  cardWidth,
  loading = false,
  pageSize,
  capForFree = false,
}: MealCarouselSectionProps) {
  const isPro = useIsPro();
  const capped = capForFree && !isPro ? meals.slice(0, FREE_RESULTS_CAP) : meals;
  const hiddenCount = meals.length - capped.length;
  const [visibleCount, setVisibleCount] = useState(pageSize ?? Infinity);
  const visible = capped.slice(0, visibleCount);
  const hasMore = visible.length < capped.length;
  // Every free result shown and more past the cap: the Pro card instead.
  const showProCard = !hasMore && hiddenCount > 0;
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
        ids: capped.map((meal) => meal.id ?? "").join(","),
        // Past the free cap: See All ends with the same Pro card.
        ...(hiddenCount > 0
          ? {
              more: String(hiddenCount),
              // The first locked meals, for See All's blurred peek.
              preview: meals.slice(capped.length, capped.length + 3).map((meal) => meal.id ?? "").join(","),
            }
          : {}),
        ...(budgetLabel ? { budget: budgetLabel } : {}),
        ...(servings ? { servings: String(servings) } : {}),
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
          ? Array.from({ length: SKELETON_COUNT }).map((_, i) => (
              <Animated.View key={`skeleton-${i}`} exiting={SKELETON_OUT}>
                <MealCardSkeleton width={cardWidth} />
              </Animated.View>
            ))
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
                  // Fades in as the skeletons fade out (and on first show).
                  <Animated.View key={meal.id} entering={CARD_IN}>
                    {card}
                  </Animated.View>
                );
              }),
              ...(hasMore
                ? [
                    <Animated.View key="show-more" entering={CARD_IN} className="flex-1">
                      <ShowMoreCard onPress={showMore} />
                    </Animated.View>,
                  ]
                : []),
              ...(showProCard
                ? [
                    <Animated.View key="see-all-pro" entering={CARD_IN} className="flex-1">
                      <SeeAllMatchesCard hiddenCount={hiddenCount} preview={meals.slice(capped.length)} width={cardWidth ?? CARD_WIDTH} />
                    </Animated.View>,
                  ]
                : []),
            ]}
      </Carousel>

      <MealDetailSheet meal={detailMeal} onClose={() => setSelectedMeal(null)} />
    </View>
  );
}
