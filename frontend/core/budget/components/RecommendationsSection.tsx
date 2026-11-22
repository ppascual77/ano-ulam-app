import { useMemo } from "react";
import { Pressable, View } from "react-native";
import Animated, { FadeIn } from "react-native-reanimated";
import { ChevronRight, Hamburger } from "lucide-react-native";
import { AppText } from "@/frontend/components/ui";
import { Text } from "@/frontend/components/ui/Text";
import { colors } from "@/frontend/constants/theme";
import { useRecommendedMeals } from "@/frontend/core/meals/hooks/useRecommendedMeals";
import { scaleMeal } from "@/frontend/core/meals/utils/scaleMeal";
import { MealCarouselSection } from "./MealCarouselSection";
import { CATEGORY_NOUNS, type CategoryId } from "../utils/categories";
import { DEFAULT_SERVINGS } from "../utils/budgetMatch";

// Unlike CommunityFavoritesSection (still mock), this is linked to real,
// already-seeded meals (see useRecommendedMeals): 10 random picks, or with a
// Categories tile picked (`category`), 10 from that category. Shown 5
// at a time with a Show More card, and no See All (the Show More card is the
// way through them; Browse is the way to everything). Shows skeleton cards while the fetch is in flight (not a mock
// fallback), so it never flashes mock content that then gets swapped for
// real meals.
export function RecommendationsSection({
  category = null,
  switching = false,
  onPickCategory,
}: {
  category?: CategoryId | null;
  /** A category switch still being prepared: skeletons meanwhile. */
  switching?: boolean;
  /** Picks another category (Fast food's "coming soon" links). */
  onPickCategory?: (id: CategoryId) => void;
}) {
  const { meals: recipes, isLoading } = useRecommendedMeals(category);
  // Priced and portioned for DEFAULT_SERVINGS, like the budget suggestions:
  // the card's price is for 2, and the detail sheet opens at 2 (useFullMeal
  // re-scales the full meal to this serving_size).
  const meals = useMemo(() => recipes.map((meal) => scaleMeal(meal, DEFAULT_SERVINGS)), [recipes]);
  // Fast food has nothing in it yet (IMP-11): say it's coming, and offer
  // the tiles that do have meals.
  if (category === "fastfood" && !isLoading && !switching && meals.length === 0) {
    return <FastFoodSoon onPickCategory={onPickCategory} />;
  }
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

function FastFoodSoon({ onPickCategory }: { onPickCategory?: (id: CategoryId) => void }) {
  return (
    <Animated.View entering={FadeIn.duration(220)} className="gap-3">
      <AppText variant="sectionTitle" dot>
        Recommendations
      </AppText>
      <View className="items-center rounded-2xl border border-dashed border-accent/30 bg-accent/5 px-6 py-6">
        <View className="h-12 w-12 items-center justify-center rounded-2xl bg-accent/15">
          <Hamburger color={colors.accent} size={22} />
        </View>
        <Text className="mt-3 text-center font-inter-bold text-subheading text-ink-emphasis">Fast food is coming soon</Text>
        <Text className="mt-1 text-center font-inter-regular text-body text-ink-subtle">
          Your go-to chains, with real prices and macros. Until then, there&apos;s plenty to cook at home.
        </Text>
        {onPickCategory && (
          <View className="mt-4 flex-row gap-6">
            {(["lunch", "dinner"] as const).map((id) => (
              <Pressable key={id} onPress={() => onPickCategory(id)} hitSlop={8} accessibilityRole="button" className="flex-row items-center gap-1 active:opacity-60">
                <Text className="font-inter-semibold text-body text-primary">See {id}</Text>
                <ChevronRight color={colors.primary} size={16} />
              </Pressable>
            ))}
          </View>
        )}
      </View>
    </Animated.View>
  );
}
