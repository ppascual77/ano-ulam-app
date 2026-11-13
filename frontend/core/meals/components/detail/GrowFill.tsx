import { useEffect, type ReactNode } from "react";
import { type StyleProp, type ViewStyle } from "react-native";
import Animated, { Easing, useAnimatedStyle, useSharedValue, withDelay, withTiming } from "react-native-reanimated";

// Ease-out-expo: fast start, long soft landing, so a bar "draws" rather
// than slides.
const GROW_EASING = Easing.bezier(0.16, 1, 0.3, 1);

type GrowFillProps = {
  /** Final width, as a percent of the parent (0-100). */
  percent: number;
  delay?: number;
  duration?: number;
  style?: StyleProp<ViewStyle>;
  children?: ReactNode;
};

// A bar fill that grows from 0 to `percent` of its parent's width on mount
// (the ingredient sheet's macro split and micronutrient bars). Remount it
// to replay. Reanimated's default ReduceMotion.System jumps straight to the
// final width when the OS asks for reduced motion.
export function GrowFill({ percent, delay = 0, duration = 600, style, children }: GrowFillProps) {
  const progress = useSharedValue(0);
  useEffect(() => {
    progress.value = withDelay(delay, withTiming(1, { duration, easing: GROW_EASING }));
  }, [progress, delay, duration]);
  const animated = useAnimatedStyle(() => ({ width: `${progress.value * percent}%` }));
  return <Animated.View style={[style, animated]}>{children}</Animated.View>;
}
