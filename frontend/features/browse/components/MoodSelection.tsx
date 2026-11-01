import { useEffect, useMemo, useState } from "react";
import { Pressable, View } from "react-native";
import * as Haptics from "expo-haptics";
import Animated, {
  Easing,
  FadeIn,
  FadeInDown,
  FadeOut,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withSpring,
  withTiming,
  type SharedValue,
} from "react-native-reanimated";
import { useReduceMotion } from "@/frontend/core/preferences/store/useReduceMotionStore";
import { BicepsFlexed, PiggyBank, Timer } from "lucide-react-native";
import type { LucideIcon } from "lucide-react-native";
import { AppText } from "@/frontend/components/ui";
import { colors } from "@/frontend/constants/theme";
import { RelatedMealCard } from "@/frontend/core/meals/components/detail/RelatedMealCard";
import type { MealType } from "@/frontend/core/meals/mealTypes";
import { usePreferredMeals } from "@/frontend/core/meals/hooks/usePreferredMeals";
import { scaleMeal } from "@/frontend/core/meals/utils/scaleMeal";

type MoodId = "tipid" | "highProtein" | "quickEasy";

// Each mood as a rule on a real meal, per serving (the subtitles' terms).
const MOOD_RULES: Record<MoodId, (perServing: MealType) => boolean> = {
  tipid: (m) => Number(m.price) > 0 && Number(m.price) < 150,
  highProtein: (m) => m.protein >= 30,
  quickEasy: (m) => m.total_time != null && m.total_time <= 20,
};

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
const TILE_GAP = 8;
// The highlight glides (lands exactly, no overshoot inside the tinted card).
const GLIDE = { duration: 260, easing: Easing.out(Easing.cubic) };

// One mood tile. The green highlight slides behind the row (MoodSelection);
// each tile fades its white face and swaps its text to white as the
// highlight passes over it, so the two never fight. Pressed, it squeezes;
// picked, its icon hops.
function MoodTile({
  mood,
  index,
  highlight,
  selected,
  onPress,
  reduce,
}: {
  mood: Mood;
  index: number;
  highlight: SharedValue<number>;
  selected: boolean;
  onPress: () => void;
  reduce: boolean;
}) {
  const press = useSharedValue(1);
  const hop = useSharedValue(0);
  useEffect(() => {
    if (!selected || reduce) return;
    hop.value = withSequence(withTiming(1, { duration: 140, easing: Easing.out(Easing.quad) }), withSpring(0, { damping: 9, stiffness: 260, mass: 0.6 }));
  }, [selected, reduce, hop]);

  // 1 under the highlight, 0 away from it (blends while it slides past).
  const faceStyle = useAnimatedStyle(() => ({ opacity: Math.min(1, Math.abs(highlight.value - index)) }));
  const onStyle = useAnimatedStyle(() => ({ opacity: Math.max(0, 1 - Math.abs(highlight.value - index)) }));
  const tileStyle = useAnimatedStyle(() => ({ transform: [{ scale: press.value }] }));
  const iconStyle = useAnimatedStyle(() => ({ transform: [{ translateY: -5 * hop.value }, { rotate: `${-8 * hop.value}deg` }] }));
  const Icon = mood.icon;

  const content = (on: boolean) => (
    <>
      <Animated.View style={iconStyle}>
        <Icon color={on ? colors.white : colors.primary} size={22} />
      </Animated.View>
      <AppText variant="bodyBold" className={`text-center ${on ? "text-white" : "text-ink-emphasis"}`}>
        {mood.label}
      </AppText>
      <AppText variant="caption" className={`text-center ${on ? "text-white" : "text-ink-subtle"}`}>
        {mood.subtitle}
      </AppText>
    </>
  );

  return (
    <Pressable
      onPress={onPress}
      onPressIn={() => {
        if (!reduce) press.value = withTiming(0.96, { duration: 80 });
      }}
      onPressOut={() => {
        press.value = withSpring(1, { damping: 14, stiffness: 400, overshootClamping: true });
      }}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      className="flex-1"
    >
      <Animated.View style={tileStyle}>
        {/* The white face (fades out under the highlight). */}
        <Animated.View
          pointerEvents="none"
          style={faceStyle}
          className="absolute inset-0 rounded-xl border border-ink-emphasis/10 bg-white"
        />
        <View className="items-center gap-1 px-2 py-3">
          <Animated.View style={faceStyle} className="items-center gap-1">
            {content(false)}
          </Animated.View>
          <Animated.View pointerEvents="none" style={onStyle} className="absolute inset-0 items-center justify-center gap-1 px-2 py-3">
            {content(true)}
          </Animated.View>
        </View>
      </Animated.View>
    </Pressable>
  );
}

type MoodSelectionProps = {
  onSelectMeal?: (meal: MealType) => void;
};

// Browse-only "ulam mood" picker: real meals (following preferences) that
// fit the mood, shown per serving so the card's price and protein match the
// mood's promise ("Under ₱150", "30g+ protein"). Not shared with any other
// feature, so it lives here instead of core/meals.
export function MoodSelection({ onSelectMeal }: MoodSelectionProps) {
  const [selectedMoodId, setSelectedMoodId] = useState<MoodId>(MOODS[0].id);
  const [pageIndex, setPageIndex] = useState(0);
  const reduce = useReduceMotion();

  // The green highlight, by tile (fractional while it slides), and one
  // tile's width (the row is three equal tiles).
  const highlight = useSharedValue(0);
  const [tileW, setTileW] = useState(0);
  const pick = (id: MoodId) => {
    if (id === selectedMoodId) return;
    void Haptics.selectionAsync();
    const i = MOODS.findIndex((m) => m.id === id);
    highlight.value = reduce ? i : withTiming(i, GLIDE);
    setSelectedMoodId(id);
  };
  const highlightStyle = useAnimatedStyle(() => ({ transform: [{ translateX: highlight.value * (tileW + TILE_GAP) }] }));

  // Restart pagination whenever the mood changes.
  useEffect(() => {
    setPageIndex(0);
  }, [selectedMoodId]);

  const { meals: catalog } = usePreferredMeals();
  const meals = useMemo(
    () => catalog.map((meal) => scaleMeal(meal, 1)).filter((perServing) => MOOD_RULES[selectedMoodId](perServing)),
    [catalog, selectedMoodId],
  );
  const totalPages = Math.ceil(meals.length / PAGE_SIZE);
  const hasMore = pageIndex < totalPages - 1;
  const pageMeals = meals.slice(pageIndex * PAGE_SIZE, pageIndex * PAGE_SIZE + PAGE_SIZE);

  return (
    <View className="rounded-2xl bg-mood-bg p-4">
      <AppText variant="sectionTitle" dot className="mb-3">
        What&apos;s your ulam mood?
      </AppText>

      <View className="flex-row" style={{ gap: TILE_GAP }} onLayout={(e) => setTileW((e.nativeEvent.layout.width - TILE_GAP * 2) / 3)}>
        {tileW > 0 && (
          <Animated.View
            pointerEvents="none"
            style={[{ position: "absolute", top: 0, bottom: 0, left: 0, width: tileW }, highlightStyle]}
            className="rounded-xl bg-primary"
          />
        )}
        {MOODS.map((mood, i) => (
          <MoodTile
            key={mood.id}
            mood={mood}
            index={i}
            highlight={highlight}
            selected={mood.id === selectedMoodId}
            onPress={() => pick(mood.id)}
            reduce={reduce}
          />
        ))}
      </View>

      {meals.length === 0 && (
        <AppText variant="caption" className="mt-4">
          No meals for this mood yet. We&apos;re still curating more.
        </AppText>
      )}

      {/* Each mood or page lands its cards quickly, one after another:
          a short rise and fade (a fade only, with reduce motion). Keyed by
          mood and page, so a switch replaces the set instead of shuffling
          it. */}
      <View className="mt-4 flex-row flex-wrap gap-3">
        {pageMeals.map((meal, i) => (
          <Animated.View
            key={`${selectedMoodId}-${pageIndex}-${meal.id}`}
            entering={(reduce ? FadeIn.duration(150) : FadeInDown.duration(220)).delay(i * 45)}
            exiting={FadeOut.duration(100)}
            // The wrapper takes the grid column (the card's own default is
            // 48% of its parent, which is now this wrapper).
            style={{ width: "48%" }}
          >
            <RelatedMealCard meal={meal} width="100%" onPress={() => onSelectMeal?.(meal)} />
          </Animated.View>
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
