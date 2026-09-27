import { useEffect } from "react";
import { View } from "react-native";
import Animated, { Easing, useAnimatedStyle, useSharedValue, withRepeat, withTiming } from "react-native-reanimated";

// Mirrors MealCard's exact proportions (same CARD_WIDTH/IMAGE_HEIGHT,
// padding, macro-row shape) so swapping skeleton -> real card doesn't
// visibly jump — shown by MealCarouselSection while a real fetch (e.g.
// Home's Recommendations) is still in flight.
const CARD_WIDTH = 250;
const IMAGE_HEIGHT = 150;
const PULSE_DURATION_MS = 700;

function Bone({ className }: { className: string }) {
  return <View className={`rounded bg-ink-emphasis/10 ${className}`} />;
}

type MealCardSkeletonProps = {
  /** Matches MealCard's own `width` prop — pass the same value at a call
   *  site that also customizes MealCard's width, so skeleton and real card
   *  line up exactly. */
  width?: number;
};

export function MealCardSkeleton({ width = CARD_WIDTH }: MealCardSkeletonProps) {
  // One shared opacity driving the whole card, not each bone independently
  // — same "single pulsing container" behavior as a CSS animate-pulse class.
  const pulse = useSharedValue(0.6);

  useEffect(() => {
    pulse.value = withRepeat(withTiming(1, { duration: PULSE_DURATION_MS, easing: Easing.inOut(Easing.ease) }), -1, true);
  }, [pulse]);

  const pulseStyle = useAnimatedStyle(() => ({ opacity: pulse.value }));

  return (
    <Animated.View
      style={[{ width }, pulseStyle]}
      className="overflow-hidden rounded-2xl border border-ink-emphasis/10 bg-white shadow-sm"
    >
      <View style={{ width, height: IMAGE_HEIGHT }} className="bg-ink-emphasis/10" />

      <View className="px-4 pt-2 pb-4">
        <Bone className="mt-2 h-5 w-3/4" />

        <View className="mt-3">
          <Bone className="h-5 w-1/2" />
          <Bone className="mt-1.5 h-3 w-1/3" />

          <View className="mt-3 flex-row justify-between gap-2 rounded-md border border-ink-emphasis/10 p-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <View key={i} className="flex-1 items-center gap-1">
                <Bone className="h-3.5 w-7" />
                <Bone className="h-3 w-9" />
              </View>
            ))}
          </View>
        </View>
      </View>
    </Animated.View>
  );
}
