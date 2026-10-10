import { useEffect } from "react";
import { Pressable, Text, View } from "react-native";
import { Image } from "expo-image";
import Animated, { Easing, useAnimatedStyle, useSharedValue, withDelay, withSpring, withTiming } from "react-native-reanimated";
import { Clock, Flame, TrendingDown } from "lucide-react-native";
import { colors } from "@/frontend/constants/theme";
import { resolveMealImage } from "@/frontend/core/meals/resolveMealImage";
import type { BestValueMeal } from "../hooks/usePriceMeals";
import { useCountTo } from "../hooks/useCountTo";

export const BEST_VALUE_CARD_WIDTH = 220;
const PHOTO_HEIGHT = 124;
// The card's little show when it appears, staggered card by card: last
// week's price gets struck through, today's counts down to it, then the
// "Save" sticker pops onto the photo's edge.
const ENTER_DELAY_MS = 350;
const STAGGER_MS = 140;
const STRIKE_MS = 300;
const COUNT_MS = 800;
const STICKER_SPRING = { damping: 9, stiffness: 220, mass: 0.6 };
// Under ₱1 isn't worth a sticker.
const MIN_SAVING = 1;

const peso = (n: number) => `₱${n.toFixed(2)}`;

type BestValueMealCardProps = {
  value: BestValueMeal;
  /** Position in the carousel, for the staggered entrance. */
  index: number;
  onPress: () => void;
};

// "This week's best value meals" card: the ingredient that got cheaper on
// the photo, last week's cost struck through, today's cost, and the saving.
export function BestValueMealCard({ value, index, onPress }: BestValueMealCardProps) {
  const { meal, drop, saving } = value;
  const now = Number(meal.price);
  const hasSaving = saving >= MIN_SAVING;
  const was = hasSaving ? now + saving : null;
  const delay = ENTER_DELAY_MS + index * STAGGER_MS;

  const shown = useCountTo(was ?? now, now, delay + STRIKE_MS, COUNT_MS);

  const strike = useSharedValue(0);
  const sticker = useSharedValue(0);
  useEffect(() => {
    strike.value = withDelay(delay, withTiming(1, { duration: STRIKE_MS, easing: Easing.out(Easing.quad) }));
    sticker.value = withDelay(delay + STRIKE_MS + COUNT_MS * 0.7, withSpring(1, STICKER_SPRING));
  }, [delay, strike, sticker]);
  const strikeStyle = useAnimatedStyle(() => ({ transform: [{ scaleX: strike.value }] }));
  const stickerStyle = useAnimatedStyle(() => ({ transform: [{ scale: sticker.value }, { rotate: "-6deg" }] }));

  const dropPct = Math.round(Math.abs(drop.pct));

  return (
    <Pressable
      onPress={onPress}
      accessibilityLabel={`${meal.name}, ${peso(now)}${was != null ? `, about ${peso(saving)} less than last week` : ""}. ${drop.name} is ${dropPct}% cheaper this week.`}
      style={{ width: BEST_VALUE_CARD_WIDTH }}
      className="overflow-hidden rounded-3xl border border-ink-emphasis/10 bg-white shadow-sm"
    >
      <View style={{ height: PHOTO_HEIGHT }}>
        <Image source={resolveMealImage(meal)} style={{ width: "100%", height: PHOTO_HEIGHT }} contentFit="cover" />
        {/* What got cheaper, on the photo: frosted-glass chip, translucent
            grey with a thin light edge, white text. */}
        <View className="absolute left-2.5 top-2.5 max-w-[85%] flex-row items-center gap-1 rounded-full border border-white/25 bg-ink-emphasis/45 px-2 py-1">
          <TrendingDown color={colors.white} size={12} strokeWidth={2.5} />
          <Text numberOfLines={1} className="shrink font-inter-semibold text-sub text-white">
            {drop.name}
          </Text>
          <Text className="font-inter-extrabold text-sub text-white">−{dropPct}%</Text>
        </View>
      </View>

      <View className="gap-1 px-3.5 pb-3.5 pt-3">
        <Text numberOfLines={2} style={{ minHeight: 48 }} className="font-inter-bold text-body-lg text-ink-emphasis">
          {meal.name}
        </Text>

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

        <View className="mt-1 flex-row items-center">
          <View className="flex-row items-center gap-3">
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
      </View>

      {hasSaving && (
        <Animated.View
          style={[{ position: "absolute", right: 10, top: PHOTO_HEIGHT - 15 }, stickerStyle]}
          className="rounded-full bg-accent px-2.5 py-1.5 shadow-sm"
        >
          <Text className="font-inter-extrabold text-sub text-white">Save ~₱{Math.round(saving)}</Text>
        </Animated.View>
      )}
    </Pressable>
  );
}
