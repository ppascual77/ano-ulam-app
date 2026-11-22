import { useEffect, type ReactNode } from "react";
import type { StyleProp, ViewStyle } from "react-native";
import Animated, { Easing, cancelAnimation, useAnimatedStyle, useSharedValue, withRepeat, withTiming } from "react-native-reanimated";
import { useReduceMotion } from "@/frontend/core/preferences/store/useReduceMotionStore";

// Every skeleton loader's motion (IMP-12): the whole placeholder gently
// breathes in opacity, ~1.2 s each way, eased, with no scale or bounce. One
// shared opacity per placeholder, so its bones move together. With Reduce
// motion it stays still (the placeholder alone says "loading").
const BREATH_MS = 1200;
const LOW = 0.45;

export function Breathing({
  children,
  className,
  style,
  active = true,
}: {
  children?: ReactNode;
  className?: string;
  style?: StyleProp<ViewStyle>;
  /** false stops it (e.g. the image behind it has loaded). */
  active?: boolean;
}) {
  const reduceMotion = useReduceMotion();
  const opacity = useSharedValue(1);
  useEffect(() => {
    if (!active || reduceMotion) {
      cancelAnimation(opacity);
      opacity.value = 1;
      return;
    }
    opacity.value = withRepeat(withTiming(LOW, { duration: BREATH_MS, easing: Easing.inOut(Easing.sin) }), -1, true);
    return () => cancelAnimation(opacity);
  }, [active, reduceMotion, opacity]);
  const breathe = useAnimatedStyle(() => ({ opacity: opacity.value }));

  return (
    <Animated.View className={className} style={[style, breathe]}>
      {children}
    </Animated.View>
  );
}
