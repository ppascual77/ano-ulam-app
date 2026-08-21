import { Pressable, View } from "react-native";
import { AppText, Carousel } from "@/components/ui";
import { MealCard } from "@/core/meals/components/MealCard";
import { mockMeals } from "@/core/meals/mocks/meals";

// TODO: navigate to a meal detail screen once one exists.
const noop = () => {};

type MealCarouselSectionProps = {
  title: string;
  showSeeAll?: boolean;
};

// Shared by RecommendationsSection and CommunityFavoritesSection — same
// layout, different heading, same mock data until there's a real endpoint
// per section.
export function MealCarouselSection({ title, showSeeAll = true }: MealCarouselSectionProps) {
  return (
    <View className="gap-3">
      <View className="flex-row items-center justify-between">
        <AppText variant="title">{title}</AppText>
        {showSeeAll && (
          <Pressable onPress={noop}>
            <AppText variant="bodyMedium" className="text-primary">
              See All
            </AppText>
          </Pressable>
        )}
      </View>

      <Carousel>
        {mockMeals.map((meal) => (
          <MealCard key={meal.id} meal={meal} onPress={noop} />
        ))}
      </Carousel>
    </View>
  );
}
