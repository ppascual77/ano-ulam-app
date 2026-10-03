import { ReactNode, useState } from "react";
import { FlatList, Pressable, Text, View } from "react-native";
import { Info, User2 } from "lucide-react-native";
import { colors } from "@/frontend/constants/theme";
import { MealCardSkeleton } from "@/frontend/core/meals/components/card/MealCardSkeleton";
import type { MealType } from "@/frontend/core/meals/mealTypes";

const CARD_WIDTH = 250;
const CARD_GAP = 16;
const SIDE = 24;
const SKELETONS = [0, 1, 2];

type Section = {
  category: string;
  title: string;
  badge?: boolean;
  info?: { title: string; body: string };
};

const SECTIONS: Section[] = [
  {
    category: "luto",
    title: "Home-cooked meals (Luto)",
    info: { title: "Home-cooked meals", body: "Meals are ulam only (no rice). Nutrition values are estimated." },
  },
  { category: "snack", title: "Snacks" },
  {
    category: "fast_food",
    title: "Fast food suggestions",
    badge: true,
    info: { title: "Fast food macros", body: "Nutritional values are estimated using standard serving sizes. Actual macros may vary." },
  },
];

function SectionHeader({ section }: { section: Section }) {
  const [infoOpen, setInfoOpen] = useState(false);
  return (
    <View className="mx-6">
      <View className="flex-row flex-wrap items-center gap-2">
        <Text className="font-inter-semibold text-body text-web-ink">{section.title}</Text>
        {section.badge && (
          <View className="flex-row items-center gap-1 rounded-full border border-brand-green/20 bg-brand-green/5 px-2 py-1">
            <User2 color={colors.brandGreen.DEFAULT} size={12} />
            <Text className="font-inter-regular text-sub text-brand-green">Single Serve</Text>
          </View>
        )}
        {section.info && (
          <Pressable onPress={() => setInfoOpen((open) => !open)} hitSlop={8} accessibilityLabel={`About ${section.info.title}`}>
            <Info color={colors.webInk.muted} size={16} />
          </Pressable>
        )}
      </View>
      {section.info && infoOpen && (
        <View className="mt-2 self-start rounded-xl bg-web-ink px-3 py-2">
          <Text className="font-inter-medium text-small text-white">{section.info.title}</Text>
          <Text className="mt-0.5 font-inter-regular text-small text-web-ink-muted">{section.info.body}</Text>
        </View>
      )}
    </View>
  );
}

type SearchResultsProps = {
  results: MealType[];
  loading: boolean;
  /** The card for one result (Browse wires like/save/details). */
  renderCard: (meal: MealType) => ReactNode;
};

// "Search Results": one swipeable row per category (Luto, Snacks, Fast
// food). While loading every row shows skeletons; after, empty rows hide.
export function SearchResults({ results, loading, renderCard }: SearchResultsProps) {
  return (
    <View className="gap-6">
      {SECTIONS.map((section) => {
        const meals = results.filter((meal) => meal.category === section.category);
        if (!loading && meals.length === 0) return null;
        return (
          <View key={section.category}>
            <SectionHeader section={section} />
            {loading ? (
              <FlatList
                horizontal
                data={SKELETONS}
                keyExtractor={(i) => String(i)}
                renderItem={() => <MealCardSkeleton />}
                showsHorizontalScrollIndicator={false}
                scrollEnabled={false}
                contentContainerStyle={{ paddingHorizontal: SIDE, paddingTop: 12, paddingBottom: 8, gap: CARD_GAP }}
              />
            ) : (
              <FlatList
                horizontal
                data={meals}
                keyExtractor={(meal) => meal.id ?? meal.name}
                renderItem={({ item }) => <>{renderCard(item)}</>}
                showsHorizontalScrollIndicator={false}
                // Each swipe settles on a card's start.
                snapToInterval={CARD_WIDTH + CARD_GAP}
                snapToAlignment="start"
                decelerationRate="fast"
                contentContainerStyle={{ paddingHorizontal: SIDE, paddingTop: 12, paddingBottom: 8, gap: CARD_GAP }}
              />
            )}
          </View>
        );
      })}
    </View>
  );
}
