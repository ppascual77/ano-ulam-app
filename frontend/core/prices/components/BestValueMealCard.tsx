import { useEffect } from "react";
import { Pressable, Text, View } from "react-native";
import { Image } from "expo-image";
import Animated, { Easing, useAnimatedStyle, useSharedValue, withDelay, withTiming } from "react-native-reanimated";
import { Clock, Flame, TrendingDown } from "lucide-react-native";
import { colors } from "@/frontend/constants/theme";
import { resolveMealImage } from "@/frontend/core/meals/resolveMealImage";
import { useReduceMotion } from "@/frontend/core/preferences/store/useReduceMotionStore";
import type { BestValueMeal } from "../hooks/usePriceMeals";
import { useCountTo } from "../hooks/useCountTo";

export const BEST_VALUE_CARD_WIDTH = 220;
const PHOTO_HEIGHT = 124;
// The card's little show when it appears, staggered card by card: last
// week's price gets struck through, today's counts down to it, then the
// saving pill fades up beside it. No bounce or tilt, so a row of cards
// settles quietly.
const ENTER_DELAY_MS = 350;
const STAGGER_MS = 140;
const STRIKE_MS = 300;
const COUNT_MS = 800;
const PILL_MS = 260;
// Under ₱1 isn't worth a pill.
const MIN_SAVING = 1;

const peso = (n: number) => `₱${n.toFixed(2)}`;

type BestValueMealCardProps = {
  value: BestValueMeal;
  /** Position in the carousel, for the staggered entrance. */
  index: number;
  onPress: () => void;
};

// "This week's best value meals" card, read top to bottom: the photo, the
// ingredient that got cheaper (its own green band, the card's reason to
// exist), the meal, then last week's cost struck through over today's,
// with the estimated saving beside it.
export function BestValueMealCard({ value, index, onPress }: BestValueMealCardProps) {
  const { meal, drop, saving } = value;
  const reduceMotion = useReduceMotion();
  const now = Number(meal.price);
  const hasSaving = saving >= MIN_SAVING;
  const was = hasSaving ? now + saving : null;
  const delay = ENTER_DELAY_MS + index * STAGGER_MS;

  const shown = useCountTo(was ?? now, now, delay + STRIKE_MS, COUNT_MS);

  const strike = useSharedValue(reduceMotion ? 1 : 0);
  const pill = useSharedValue(reduceMotion ? 1 : 0);
  useEffect(() => {
    if (reduceMotion) {
      strike.value = 1;
      pill.value = 1;
      return;
    }
    strike.value = withDelay(delay, withTiming(1, { duration: STRIKE_MS, easing: Easing.out(Easing.quad) }));
    pill.value = withDelay(delay + STRIKE_MS + COUNT_MS * 0.7, withTiming(1, { duration: PILL_MS, easing: Easing.out(Easing.cubic) }));
  }, [delay, strike, pill, reduceMotion]);
  const strikeStyle = useAnimatedStyle(() => ({ transform: [{ scaleX: strike.value }] }));
  const pillStyle = useAnimatedStyle(() => ({
    opacity: pill.value,
    transform: [{ translateY: (1 - pill.value) * 4 }],
  }));

  const dropPct = Math.round(Math.abs(drop.pct));

  return (
    <Pressable
      onPress={onPress}
      accessibilityLabel={`${meal.name}, ${peso(now)}${was != null ? `, about ${peso(saving)} less than last week` : ""}. ${drop.name} is ${dropPct}% cheaper this week.`}
      style={{ width: BEST_VALUE_CARD_WIDTH }}
      className="overflow-hidden rounded-3xl border border-ink-emphasis/10 bg-white shadow-sm active:opacity-90"
    >
      <Image source={resolveMealImage(meal)} style={{ width: "100%", height: PHOTO_HEIGHT }} contentFit="cover" />

      {/* What got cheaper: full-width band under the photo in Price Watch's
          "cheaper" green, so it reads at a glance instead of hiding on the
          photo. */}
      <View className="flex-row items-center gap-2 bg-trend-down/10 px-3.5 py-2">
        <View className="h-5 w-5 items-center justify-center rounded-full bg-trend-down">
          <TrendingDown color={colors.white} size={12} strokeWidth={2.5} />
        </View>
        <Text numberOfLines={1} className="shrink font-inter-semibold text-small text-ink-emphasis">
          {drop.name}
        </Text>
        <Text className="ml-auto font-inter-extrabold text-small text-trend-down">−{dropPct}%</Text>
      </View>

      <View className="gap-2 px-3.5 pb-3.5 pt-3">
        <Text numberOfLines={2} style={{ minHeight: 48 }} className="font-inter-bold text-body-lg text-ink-emphasis">
          {meal.name}
        </Text>

        <View className="flex-row items-end justify-between gap-2">
          <View>
            {/* Always takes its line (blank when there's no saving), so every
                card in the carousel is the same height. */}
            <View className="self-start">
              <Text className="font-inter-medium text-small text-ink-subtle">{was != null ? peso(was) : " "}</Text>
              {was != null && (
                <Animated.View
                  className="absolute left-0 right-0 h-0.5 rounded-full bg-like"
                  style={[{ top: "50%", transformOrigin: "left" }, strikeStyle]}
                />
              )}
            </View>
            <Text style={{ fontVariant: ["tabular-nums"] }} className="font-inter-extrabold text-heading tracking-display text-primary">
              {peso(shown)}
            </Text>
          </View>
          {hasSaving && (
            <Animated.View style={pillStyle} className="mb-1 rounded-full bg-accent/10 px-2.5 py-1">
              <Text className="font-inter-bold text-sub text-accent">Save ~₱{Math.round(saving)}</Text>
            </Animated.View>
          )}
        </View>

        <View className="flex-row items-center gap-3 border-t border-ink-emphasis/10 pt-2.5">
          {meal.total_time != null && (
            <View className="flex-row items-center gap-1">
              <Clock color={colors.ink.subtle} size={12} />
              <Text className="font-inter-regular text-small text-ink-subtle">{meal.total_time} min</Text>
            </View>
          )}
          <View className="flex-row items-center gap-1">
            <Flame color={colors.like} size={12} />
            <Text className="font-inter-regular text-small text-ink-subtle">{meal.calories} kcal</Text>
          </View>
        </View>
      </View>
    </Pressable>
  );
}
