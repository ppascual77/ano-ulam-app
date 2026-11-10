import { useEffect, useMemo, useState } from "react";
import { View } from "react-native";
import * as Haptics from "expo-haptics";
import Animated, { Easing, FadeIn, FadeInDown, FadeOut } from "react-native-reanimated";
import { AppText, Button, SegmentedSwitch } from "@/frontend/components/ui";
import { MealPhotoTile } from "@/frontend/core/meals/components/card/MealPhotoTile";
import type { MealType } from "@/frontend/core/meals/mealTypes";
import { usePreferredMeals } from "@/frontend/core/meals/hooks/usePreferredMeals";
import { scaleMeal } from "@/frontend/core/meals/utils/scaleMeal";
import { useReduceMotion } from "@/frontend/core/preferences/store/useReduceMotionStore";

type MoodId = "tipid" | "highProtein" | "quickEasy";

const priceOf = (m: MealType) => Number(m.price);
// Per-serving prices come out of scaleMeal with decimals ("140.00"): whole pesos read cleaner.
const pesoLabel = (m: MealType) => `₱${Math.round(priceOf(m))}`;
const proteinLabel = (m: MealType) => `${Math.round(m.protein)}g protein`;
const timeLabel = (m: MealType) => (m.total_time != null ? `${m.total_time} min` : null);

type Mood = {
  id: MoodId;
  label: string;
  /** The promise (documents the rule; not shown). */
  caption: string;
  /** The rule, on a real meal per serving (the caption's terms). */
  fits: (perServing: MealType) => boolean;
  /** Best fit first: cheapest, most protein, quickest. */
  sort: (a: MealType, b: MealType) => number;
  /** The tile's big number: what proves the meal fits. */
  stat: (m: MealType) => string;
  /** The line under the name: the meal's other two facts (just the first
   *  on the narrow side-by-side tiles). */
  facts: (m: MealType, short?: boolean) => string;
};

const join = (short: boolean | undefined, ...parts: (string | null)[]) =>
  parts.filter(Boolean).slice(0, short ? 1 : undefined).join(" · ");

const MOODS: Mood[] = [
  {
    id: "tipid",
    label: "Tipid",
    caption: "Under ₱150 a serving",
    fits: (m) => priceOf(m) > 0 && priceOf(m) < 150,
    sort: (a, b) => priceOf(a) - priceOf(b),
    stat: pesoLabel,
    facts: (m, short) => join(short, proteinLabel(m), timeLabel(m)),
  },
  {
    id: "highProtein",
    label: "High Protein",
    caption: "30g+ protein a serving",
    fits: (m) => m.protein >= 30,
    sort: (a, b) => b.protein - a.protein,
    stat: (m) => `${Math.round(m.protein)}g`,
    facts: (m, short) => join(short, pesoLabel(m), timeLabel(m)),
  },
  {
    id: "quickEasy",
    label: "Quick & Easy",
    caption: "Ready in 20 minutes or less",
    fits: (m) => m.total_time != null && m.total_time <= 20,
    sort: (a, b) => (a.total_time ?? 0) - (b.total_time ?? 0),
    stat: (m) => `${m.total_time} min`,
    facts: (m, short) => join(short, pesoLabel(m), proteinLabel(m)),
  },
];

const MOOD_OPTIONS = MOODS.map((m) => ({ value: m.id, label: m.label }));

// Each "page" is one block of the spread: a wide lead, two side by side, a
// wide closer. Show more adds the next block under it.
const PAGE_SIZE = 4;
const GAP = 6;
const WIDE_HEIGHT = 200;
const PAIR_HEIGHT = 220;
const CLOSER_HEIGHT = 170;
const EASE = Easing.out(Easing.cubic);

type MoodSelectionProps = {
  onSelectMeal?: (meal: MealType) => void;
};

// Browse-only "ulam mood" picker: real meals (following preferences) that
// fit the mood, per serving so each tile's numbers match the mood's promise.
// Same photo tiles as Home's Community Favorites, in its own shape (wide,
// pair, wide), with the mood's number where Favorites puts the rank. Not
// shared with any other feature, so it lives here instead of core/meals.
export function MoodSelection({ onSelectMeal }: MoodSelectionProps) {
  const [moodId, setMoodId] = useState<MoodId>(MOODS[0].id);
  const [pages, setPages] = useState(1);
  const reduce = useReduceMotion();
  const mood = MOODS.find((m) => m.id === moodId)!;

  const pick = (id: MoodId) => {
    if (id === moodId) return;
    void Haptics.selectionAsync();
    setMoodId(id);
  };

  // Back to one block whenever the mood changes.
  useEffect(() => {
    setPages(1);
  }, [moodId]);

  const { meals: catalog, isLoading } = usePreferredMeals();
  const meals = useMemo(
    () =>
      catalog
        .map((meal) => scaleMeal(meal, 1))
        .filter(mood.fits)
        .sort(mood.sort),
    [catalog, mood],
  );
  const shown = meals.slice(0, pages * PAGE_SIZE);
  const blocks = Array.from({ length: Math.ceil(shown.length / PAGE_SIZE) }, (_, i) => shown.slice(i * PAGE_SIZE, i * PAGE_SIZE + PAGE_SIZE));
  const hasMore = shown.length < meals.length;

  // Tiles rise in turn; a new block's tiles stagger on their own, so Show
  // more doesn't wait behind the ones already there.
  const enter = (i: number) =>
    reduce ? FadeIn.duration(180) : FadeInDown.delay((i % PAGE_SIZE) * 60).duration(320).easing(EASE);

  const tile = (meal: MealType, i: number, size: "large" | "medium", height: number, narrow = false) => (
    <Animated.View key={`${moodId}-${meal.id}`} entering={enter(i)} exiting={FadeOut.duration(120)} style={{ flex: 1 }}>
      <MealPhotoTile
        meal={meal}
        size={size}
        height={height}
        stat={mood.stat(meal)}
        caption={mood.facts(meal, narrow)}
        onPress={() => onSelectMeal?.(meal)}
        accessibilityLabel={`${meal.name}, ${mood.stat(meal)}, ${mood.facts(meal)}`}
      />
    </Animated.View>
  );

  return (
    <View className="gap-3">
      <AppText variant="sectionTitle" dot>
        What&apos;s your ulam mood?
      </AppText>

      <SegmentedSwitch size="md" options={MOOD_OPTIONS} value={moodId} onChange={pick} />

      {isLoading ? (
        <View style={{ gap: GAP }}>
          <View style={{ height: WIDE_HEIGHT }} className="rounded-2xl bg-ink-emphasis/5" />
          <View className="flex-row" style={{ gap: GAP }}>
            <View style={{ height: PAIR_HEIGHT }} className="flex-1 rounded-2xl bg-ink-emphasis/5" />
            <View style={{ height: PAIR_HEIGHT }} className="flex-1 rounded-2xl bg-ink-emphasis/5" />
          </View>
        </View>
      ) : meals.length === 0 ? (
        <AppText variant="caption">No meals for this mood yet. We&apos;re still curating more.</AppText>
      ) : (
        <View style={{ gap: GAP }}>
          {blocks.map((block, b) => {
            const [lead, left, right, closer] = block;
            const at = b * PAGE_SIZE;
            return (
              <View key={`${moodId}-block-${b}`} style={{ gap: GAP }}>
                {lead && <View className="flex-row">{tile(lead, at, "large", WIDE_HEIGHT)}</View>}
                {left && (
                  <View className="flex-row" style={{ gap: GAP }}>
                    {tile(left, at + 1, "medium", PAIR_HEIGHT, true)}
                    {right ? tile(right, at + 2, "medium", PAIR_HEIGHT, true) : <View style={{ flex: 1 }} />}
                  </View>
                )}
                {closer && <View className="flex-row">{tile(closer, at + 3, "medium", CLOSER_HEIGHT)}</View>}
              </View>
            );
          })}
        </View>
      )}

      {hasMore && (
        <Button
          variant="outline"
          label="Show more"
          onPress={() => setPages((p) => p + 1)}
          style={{ alignSelf: "center", paddingHorizontal: 28 }}
        />
      )}
    </View>
  );
}
