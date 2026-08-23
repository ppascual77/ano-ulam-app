import { useEffect, useState } from "react";
import { Pressable, View } from "react-native";
import { BicepsFlexed, PiggyBank, Timer } from "lucide-react-native";
import type { LucideIcon } from "lucide-react-native";
import { AppText } from "@/components/ui";
import { colors } from "@/constants/theme";
import { RelatedMealCard } from "@/core/meals/components/detail/RelatedMealCard";
import { MOOD_MEALS } from "../mocks/moodMeals";
import type { MoodId } from "../mocks/moodMeals";
import type { MealType } from "@/core/meals/mealTypes";

type Mood = {
  id: MoodId;
  label: string;
  subtitle: string;
  icon: LucideIcon;
};

const MOODS: Mood[] = [
  { id: "tipid", label: "Tipid Meals", subtitle: "Under ₱150", icon: PiggyBank },
  { id: "highProtein", label: "High Protein", subtitle: "30g+ protein", icon: BicepsFlexed },
  { id: "quickEasy", label: "Quick & Easy", subtitle: "Under 20 min", icon: Timer },
];

const PAGE_SIZE = 4;

type MoodSelectionProps = {
  onSelectMeal?: (meal: MealType) => void;
};

// Browse-only "ulam mood" picker — not shared with any other feature, so
// this (and its mock data in ../mocks/moodMeals) lives here instead of
// core/meals.
export function MoodSelection({ onSelectMeal }: MoodSelectionProps) {
  const [selectedMoodId, setSelectedMoodId] = useState<MoodId>(MOODS[0].id);
  const [pageIndex, setPageIndex] = useState(0);

  // Restart pagination whenever the mood changes.
  useEffect(() => {
    setPageIndex(0);
  }, [selectedMoodId]);

  const meals = MOOD_MEALS[selectedMoodId];
  const totalPages = Math.ceil(meals.length / PAGE_SIZE);
  const hasMore = pageIndex < totalPages - 1;
  const pageMeals = meals.slice(pageIndex * PAGE_SIZE, pageIndex * PAGE_SIZE + PAGE_SIZE);

  return (
    <View className="rounded-2xl bg-mood-bg p-4">
      <AppText variant="title" className="mb-3">
        What&apos;s your ulam mood?
      </AppText>

      <View className="flex-row gap-2">
        {MOODS.map((mood) => {
          const isSelected = mood.id === selectedMoodId;
          const Icon = mood.icon;

          return (
            <Pressable
              key={mood.id}
              onPress={() => setSelectedMoodId(mood.id)}
              className={`flex-1 items-center gap-1 rounded-xl border px-2 py-3 ${
                isSelected ? "border-primary bg-primary" : "border-ink-emphasis/10 bg-white"
              }`}
            >
              <Icon color={isSelected ? colors.white : colors.primary} size={22} />
              <AppText variant="bodyBold" className={`text-center ${isSelected ? "text-white" : "text-ink-emphasis"}`}>
                {mood.label}
              </AppText>
              <AppText variant="caption" className={`text-center ${isSelected ? "text-white" : "text-ink-subtle"}`}>
                {mood.subtitle}
              </AppText>
            </Pressable>
          );
        })}
      </View>

      <View className="mt-4 flex-row flex-wrap gap-3">
        {pageMeals.map((meal) => (
          <RelatedMealCard key={meal.id} meal={meal} onPress={() => onSelectMeal?.(meal)} />
        ))}
      </View>

      {hasMore && (
        <Pressable
          onPress={() => setPageIndex((p) => Math.min(p + 1, totalPages - 1))}
          className="mt-3 self-end"
        >
          <AppText variant="bodyMedium" className="text-ink-emphasis underline">
            View more
          </AppText>
        </Pressable>
      )}
    </View>
  );
}
