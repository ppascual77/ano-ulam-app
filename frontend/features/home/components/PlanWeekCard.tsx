import { memo, useEffect, useMemo } from "react";
import { Pressable, Text, View } from "react-native";
import Animated, { Easing, useAnimatedStyle, useSharedValue, withDelay, withTiming } from "react-native-reanimated";
import { Image } from "expo-image";
import { router } from "expo-router";
import { ArrowRight } from "lucide-react-native";
import { colors } from "@/frontend/constants/theme";
import { ProBadge } from "@/frontend/core/pro/components/ProBadge";
import { useRealMeals } from "@/frontend/core/meals/hooks/useRealMeals";
import { usePreferences } from "@/frontend/core/preferences/hooks/usePreferences";
import { useReduceMotion } from "@/frontend/core/preferences/store/useReduceMotionStore";
import { useIsPro } from "@/frontend/core/pro/store/useProStore";

const PHOTO_SIZE = 76;
const EASE = Easing.out(Easing.cubic);
// The fan: each photo's resting tilt and offset (back to front).
const FAN = [
  { rotate: -12, x: -26, y: 6 },
  { rotate: 10, x: 24, y: 8 },
  { rotate: -2, x: 0, y: -4 },
];

// One photo in the fan: starts stacked and straight, then settles into its
// tilt and place, once (no bounce).
function FanPhoto({ uri, index, reduceMotion }: { uri: string | null; index: number; reduceMotion: boolean }) {
  const spread = useSharedValue(reduceMotion ? 1 : 0);
  useEffect(() => {
    if (!reduceMotion) spread.value = withDelay(120 + index * 60, withTiming(1, { duration: 520, easing: EASE }));
  }, [reduceMotion, index, spread]);
  const { rotate, x, y } = FAN[index];
  const style = useAnimatedStyle(() => ({
    transform: [{ translateX: x * spread.value }, { translateY: y * spread.value }, { rotate: `${rotate * spread.value}deg` }],
  }));
  return (
    <Animated.View style={[{ position: "absolute", width: PHOTO_SIZE, height: PHOTO_SIZE }, style]}>
      <View className="flex-1 overflow-hidden rounded-2xl border-2 border-white bg-ink-emphasis/5 shadow-sm">
        {uri && <Image source={{ uri }} style={{ width: "100%", height: "100%" }} contentFit="cover" transition={200} />}
      </View>
    </Animated.View>
  );
}

type PlanWeekCardProps = {
  /** Defaults to "Plan your week". */
  title?: string;
  /** Defaults to what a plan gives you, for your plan length. */
  subtitle?: string;
  /** Defaults to "Start planning". */
  cta?: string;
};

// Home's invitation to the Meal Planner when no plan is running (see
// HomePlanCard): a soft green card with the headline, one line on what you
// get and a button, and three home-cooked meal photos fanned on the right
// (a different three each day) that settle into place once.
function PlanWeekCardInner({ title = "Plan your week", subtitle, cta = "Start planning" }: PlanWeekCardProps) {
  const { data: meals } = useRealMeals();
  const reduceMotion = useReduceMotion();
  // The plan length you'd get: Pro's choice in Settings, else 5.
  const isPro = useIsPro();
  const { prefs } = usePreferences();
  const days = isPro ? prefs.planner_defaults.days : 5;

  const photos = useMemo(() => {
    const withPhotos = (meals ?? []).filter((m) => m.image_url && m.category !== "fast_food");
    if (withPhotos.length === 0) return [null, null, null];
    const dayOffset = Math.floor(Date.now() / 86_400_000) % withPhotos.length;
    return FAN.map((_, i) => withPhotos[(dayOffset + i) % withPhotos.length].image_url as string);
  }, [meals]);
  const line = subtitle ?? `${days} days of meals and one grocery list, all within your budget.`;

  return (
    // The shadow sits on a wrapper: the card's own overflow-hidden (for its
    // rounded corners) would clip it on iOS.
    <View className="rounded-3xl bg-white shadow-sm">
      <Pressable
        onPress={() => router.push("/meal-planner")}
        accessibilityRole="button"
        accessibilityLabel={`${title}, a Pro feature. ${line}`}
        // White like Today's plan card, over Home's dark green.
        className="overflow-hidden rounded-3xl bg-white active:opacity-90"
      >
        <View className="flex-row items-center px-5 py-5">
          <View className="flex-1 gap-2 pr-2">
            <View className="flex-row items-center gap-2">
              <Text className="font-inter-bold text-sub uppercase text-primary">Meal planner</Text>
              <ProBadge />
            </View>
            <Text className="font-inter-extrabold text-heading tracking-display text-ink-emphasis">
              {title}
              <Text className="text-accent">.</Text>
            </Text>
            <Text className="font-inter-regular text-small text-ink-subtle">{line}</Text>
            <View className="mt-1 flex-row items-center gap-1.5 self-start rounded-full bg-primary px-4 py-2">
              <Text className="font-inter-semibold text-small text-white">{cta}</Text>
              <ArrowRight color={colors.white} size={14} />
            </View>
          </View>
          <View className="h-28 w-32 items-center justify-center">
            {photos.map((uri, i) => (
              <FanPhoto key={i} uri={uri} index={i} reduceMotion={reduceMotion} />
            ))}
          </View>
        </View>
      </Pressable>
    </View>
  );
}

// Skips Home's re-renders (any route change re-renders Home, which reads
// its URL params), unless its own props change.
export const PlanWeekCard = memo(PlanWeekCardInner);
