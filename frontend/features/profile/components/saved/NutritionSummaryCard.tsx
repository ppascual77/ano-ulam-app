import { useEffect } from "react";
import { Pressable, Text, View } from "react-native";
import Animated, { Easing, useAnimatedStyle, useSharedValue, withDelay, withTiming } from "react-native-reanimated";
import { ChevronRight } from "lucide-react-native";
import { DotLabel } from "@/frontend/components/ui";
import { colors } from "@/frontend/constants/theme";
import { useReduceMotion } from "@/frontend/core/preferences/store/useReduceMotionStore";
import type { SavedMeal } from "@/frontend/core/saved/types";
import { MACROS, macroSplit, sumSaved } from "./nutritionTotals";

// The split bar grows in from the left once the card lands, so the eye
// reads the kcal number first, then the mix under it.
const BAR_DELAY_MS = 150;
const BAR_MS = 700;

// Top of the Saved tab (with at least one saved meal): a preview of what
// the saved list adds up to, and the way into the full breakdown. Sits
// above the grid instead of floating over it, so it never covers a card
// and reads as part of the list it summarizes. "See breakdown" sits
// top-right, where the eye enters the card; the whole card is the target.
export function NutritionSummaryCard({ saved, onPress }: { saved: SavedMeal[]; onPress: () => void }) {
  const reduceMotion = useReduceMotion();
  const totals = sumSaved(saved);
  const split = macroSplit(totals);
  const count = saved.length;

  const grow = useSharedValue(reduceMotion ? 1 : 0);
  useEffect(() => {
    if (reduceMotion) {
      grow.value = 1;
      return;
    }
    grow.value = withDelay(BAR_DELAY_MS, withTiming(1, { duration: BAR_MS, easing: Easing.out(Easing.cubic) }));
  }, [grow, reduceMotion]);
  const barStyle = useAnimatedStyle(() => ({ width: `${grow.value * 100}%` }));

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`Nutrition breakdown of your ${count} saved meals, ${Math.round(totals.calories)} calories combined`}
      className="mb-4 rounded-3xl border border-ink-emphasis/10 bg-white p-4 active:scale-[0.99] active:bg-ink-emphasis/5"
    >
      <View className="flex-row items-center justify-between">
        <DotLabel>Your saved meals</DotLabel>
        <View className="flex-row items-center">
          <Text className="font-inter-semibold text-body text-primary">See breakdown</Text>
          <ChevronRight color={colors.primary} size={16} />
        </View>
      </View>

      <View className="mt-2 flex-row items-baseline gap-1.5">
        <Text style={{ fontVariant: ["tabular-nums"] }} className="font-inter-extrabold text-heading tracking-display text-ink-emphasis">
          {Math.round(totals.calories).toLocaleString("en-PH")}
        </Text>
        <Text className="font-inter-regular text-body text-ink-subtle">
          kcal across {count} {count === 1 ? "meal" : "meals"}
        </Text>
      </View>

      {/* Calorie share of each macro, in MacroSection's order and colors. */}
      <View className="mt-3 h-2 overflow-hidden rounded-full bg-ink-emphasis/5">
        <Animated.View style={barStyle} className="h-full flex-row gap-0.5">
          {MACROS.filter((m) => split[m.key] > 0).map((m) => (
            <View key={m.key} className="h-full rounded-full" style={{ flex: split[m.key], backgroundColor: m.color }} />
          ))}
        </Animated.View>
      </View>

      <View className="mt-3 flex-row items-center gap-4">
        {MACROS.map((m) => (
          <View key={m.key} className="flex-row items-center gap-1.5">
            <View className="h-2 w-2 rounded-full" style={{ backgroundColor: m.color }} />
            <Text className="font-inter-regular text-small text-ink-subtle">
              {m.label} <Text className={`font-inter-semibold ${m.textClassName}`}>{split[m.key]}%</Text>
            </Text>
          </View>
        ))}
      </View>
    </Pressable>
  );
}
