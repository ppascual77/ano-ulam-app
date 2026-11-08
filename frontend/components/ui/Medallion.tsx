import { useEffect } from "react";
import { View } from "react-native";
import Animated, { Easing, useAnimatedStyle, useSharedValue, withDelay, withSpring, withTiming } from "react-native-reanimated";
import type { LucideIcon } from "lucide-react-native";
import { colors } from "@/frontend/constants/theme";

type MedallionProps = {
  Icon: LucideIcon;
  /** "accent" (Pro rewards) or "primary" (e.g. a submitted recipe). */
  tone?: "accent" | "primary";
  size?: number;
  /** When the pop starts, in ms from mount. */
  delay?: number;
  /** Still: shown at once, no pop or rings. */
  reduceMotion?: boolean;
};

const RING_MS = 1100;
const RING_STAGGER = 220;

// One soft ring rippling out from the medallion and fading as it grows.
function Ring({ size, color, delay }: { size: number; color: string; delay: number }) {
  const ring = useSharedValue(0);
  useEffect(() => {
    ring.value = withDelay(delay, withTiming(1, { duration: RING_MS, easing: Easing.out(Easing.quad) }));
    // Once, on mount.
  }, []);
  const style = useAnimatedStyle(() => ({
    opacity: ring.value === 0 ? 0 : 0.45 * (1 - ring.value),
    transform: [{ scale: 1 + 0.9 * ring.value }],
  }));
  return (
    <Animated.View
      pointerEvents="none"
      style={[{ position: "absolute", width: size, height: size, borderRadius: size / 2, borderWidth: 2, borderColor: color }, style]}
    />
  );
}

// A solid round badge with a white icon that pops in with a spring and sends
// out two soft rings: the app's "something good happened" moment (Pro
// rewards, a submitted recipe). Plays once on mount.
export function Medallion({ Icon, tone = "accent", size = 72, delay = 0, reduceMotion = false }: MedallionProps) {
  const color = tone === "accent" ? colors.accent : colors.primary;
  const pop = useSharedValue(reduceMotion ? 1 : 0);
  useEffect(() => {
    if (reduceMotion) return;
    pop.value = withDelay(delay, withSpring(1, { damping: 10, stiffness: 180, mass: 0.7 }));
    // Once, on mount.
  }, []);
  const popStyle = useAnimatedStyle(() => ({ opacity: Math.min(1, pop.value * 2), transform: [{ scale: 0.4 + 0.6 * pop.value }] }));

  return (
    <View style={{ width: size, height: size, alignItems: "center", justifyContent: "center" }}>
      {!reduceMotion && (
        <>
          <Ring size={size} color={color} delay={delay + 120} />
          <Ring size={size} color={color} delay={delay + 120 + RING_STAGGER} />
        </>
      )}
      <Animated.View
        style={[{ width: size, height: size, borderRadius: size / 2, backgroundColor: color, alignItems: "center", justifyContent: "center" }, popStyle]}
      >
        <Icon color={colors.white} size={size * 0.42} strokeWidth={2.2} />
      </Animated.View>
    </View>
  );
}
