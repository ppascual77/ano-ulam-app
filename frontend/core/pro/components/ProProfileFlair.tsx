import { type ReactNode, useEffect, useState } from "react";
import { Text, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import Animated, {
  Easing,
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import { Sparkles } from "lucide-react-native";
import { colors } from "@/frontend/constants/theme";
import { useReduceMotion } from "@/frontend/core/preferences/store/useReduceMotionStore";
import { ProBadge } from "./ProBadge";

// A Pro user's own profile header, in three quiet layers that play once as
// the profile opens (never loop; still with Reduce motion):
// - ProAvatarRing: an accent ring around the avatar that settles in like a
//   halo, then one soft glow ripples out from it;
// - ProNameBadge: the PRO badge after the name, popping in a beat later
//   with a glint of light crossing it (again every 10 seconds);
// - ProMemberLine: a small sparkle and "Pro since Nov 2026" (or "Earned
//   Pro · until Nov 22") under the bio.

const EASE = Easing.out(Easing.cubic);
// The timeline, in ms from the profile appearing.
const T = { ring: 80, glow: 380, badge: 320, glint: 620, line: 520 };
const RING = { gap: 3, stroke: 2 };

/** Wraps the avatar (`size`, its diameter) in Pro's accent ring. */
export function ProAvatarRing({ size, children }: { size: number; children: ReactNode }) {
  const reduceMotion = useReduceMotion();
  const outer = size + (RING.gap + RING.stroke) * 2;
  const ring = useSharedValue(reduceMotion ? 1 : 0);
  const glow = useSharedValue(0);

  useEffect(() => {
    if (reduceMotion) return;
    ring.value = withDelay(T.ring, withTiming(1, { duration: 520, easing: EASE }));
    glow.value = withDelay(T.glow, withTiming(1, { duration: 900, easing: Easing.out(Easing.quad) }));
    // Once, as the profile opens.
  }, []);

  // The ring settles in from a little larger, like a halo landing.
  const ringStyle = useAnimatedStyle(() => ({
    opacity: ring.value,
    transform: [{ scale: 1.12 - 0.12 * ring.value }],
  }));
  // One soft ripple out from the ring, fading as it grows.
  const glowStyle = useAnimatedStyle(() => ({
    opacity: glow.value === 0 ? 0 : 0.35 * (1 - glow.value),
    transform: [{ scale: 1 + 0.35 * glow.value }],
  }));

  const circle = { position: "absolute" as const, width: outer, height: outer, borderRadius: outer / 2 };
  return (
    <View style={{ width: outer, height: outer, alignItems: "center", justifyContent: "center" }}>
      <Animated.View pointerEvents="none" style={[circle, { backgroundColor: colors.accent }, glowStyle]} />
      <Animated.View pointerEvents="none" style={[circle, { borderWidth: RING.stroke, borderColor: colors.accent }, ringStyle]} />
      {children}
    </View>
  );
}

// The glint: a narrow white band crossing the badge, as it pops in and then
// every 10 seconds.
const GLINT_MS = 520;
const GLINT_EVERY_MS = 10_000;
const GLINT_WIDTH = 14;
const GLINT_BAND = ["rgba(255,255,255,0)", "rgba(255,255,255,0.85)", "rgba(255,255,255,0)"] as const;

/** The PRO badge after the name. */
export function ProNameBadge() {
  const reduceMotion = useReduceMotion();
  const [width, setWidth] = useState(0);
  const pop = useSharedValue(reduceMotion ? 1 : 0);
  const glint = useSharedValue(0);

  useEffect(() => {
    if (reduceMotion) return;
    pop.value = withDelay(T.badge, withSpring(1, { damping: 11, stiffness: 220, mass: 0.6 }));
    // Once, as the profile opens.
  }, []);
  useEffect(() => {
    if (reduceMotion || width === 0) return;
    // A glint as it pops in, then one every GLINT_EVERY_MS: across (hidden
    // at the far edge), a rest, then back to the start while invisible.
    glint.value = withDelay(
      T.glint,
      withRepeat(
        withSequence(
          withTiming(1, { duration: GLINT_MS, easing: Easing.inOut(Easing.quad) }),
          withTiming(1, { duration: GLINT_EVERY_MS - GLINT_MS }),
          withTiming(0, { duration: 0 }),
        ),
        -1,
      ),
    );
    return () => cancelAnimation(glint);
  }, [width]);

  const popStyle = useAnimatedStyle(() => ({ opacity: Math.min(1, pop.value * 1.5), transform: [{ scale: 0.6 + 0.4 * pop.value }] }));
  const glintStyle = useAnimatedStyle(() => ({
    opacity: glint.value > 0 && glint.value < 1 ? 1 : 0,
    transform: [{ translateX: -GLINT_WIDTH + (width + GLINT_WIDTH * 2) * glint.value }, { rotate: "20deg" }],
  }));

  return (
    <Animated.View style={popStyle} accessibilityLabel="Pro member">
      <View onLayout={(e) => setWidth(e.nativeEvent.layout.width)} className="overflow-hidden rounded-full">
        <ProBadge />
        {!reduceMotion && (
          <Animated.View pointerEvents="none" style={[{ position: "absolute", top: -6, bottom: -6, left: 0, width: GLINT_WIDTH }, glintStyle]}>
            <LinearGradient colors={GLINT_BAND} start={{ x: 0, y: 0.5 }} end={{ x: 1, y: 0.5 }} style={{ flex: 1 }} />
          </Animated.View>
        )}
      </View>
    </Animated.View>
  );
}

const monthYear = (iso: string) => new Date(iso).toLocaleDateString("en-PH", { month: "short", year: "numeric" });
const monthDay = (iso: string) => new Date(iso).toLocaleDateString("en-PH", { month: "short", day: "numeric" });

/** "Pro since Nov 2026" (a subscriber, from their first purchase), or
 *  "Earned Pro · until Nov 22" (earned days, no subscription). */
export function ProMemberLine({ since, earnedUntil }: { since?: string | null; earnedUntil?: string | null }) {
  const reduceMotion = useReduceMotion();
  const shown = useSharedValue(reduceMotion ? 1 : 0);
  useEffect(() => {
    if (reduceMotion) return;
    shown.value = withDelay(T.line, withTiming(1, { duration: 360, easing: EASE }));
    // Once, as the profile opens.
  }, []);
  const style = useAnimatedStyle(() => ({ opacity: shown.value, transform: [{ translateY: 4 * (1 - shown.value) }] }));

  const text = since ? `Pro since ${monthYear(since)}` : earnedUntil ? `Earned Pro · until ${monthDay(earnedUntil)}` : null;
  if (!text) return null;
  return (
    <Animated.View style={style}>
      <View className="mt-1.5 flex-row items-center gap-1.5">
        <Sparkles color={colors.accent} size={12} strokeWidth={2.5} />
        <Text className="font-inter-semibold text-sub text-accent">{text}</Text>
      </View>
    </Animated.View>
  );
}
