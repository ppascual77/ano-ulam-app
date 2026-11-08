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
import { colors } from "@/frontend/constants/theme";
import { useReduceMotion } from "@/frontend/core/preferences/store/useReduceMotionStore";
import { ProBadge } from "./ProBadge";

// A Pro user's own profile header, in two quiet layers (still with Reduce
// motion):
// - ProAvatarRing: an accent ring around the avatar that settles in like a
//   halo, then one soft glow ripples out from it; a glint crosses the
//   avatar as the profile opens and every 10 seconds;
// - ProNameBadge: the PRO badge after the name, popping in a beat later
//   with a glint of light crossing it (again every 10 seconds, in step
//   with the same glint on the avatar).

const EASE = Easing.out(Easing.cubic);
// The timeline, in ms from the profile appearing.
const T = { ring: 80, glow: 380, badge: 320, glint: 620 };
const RING = { gap: 3, stroke: 2 };

/** Wraps the avatar (`size`, its diameter) in Pro's accent ring. */
export function ProAvatarRing({ size, children }: { size: number; children: ReactNode }) {
  const reduceMotion = useReduceMotion();
  const outer = size + (RING.gap + RING.stroke) * 2;
  const ring = useSharedValue(reduceMotion ? 1 : 0);
  const glow = useSharedValue(0);
  const glint = useSharedValue(0);

  useEffect(() => {
    if (reduceMotion) return;
    ring.value = withDelay(T.ring, withTiming(1, { duration: 520, easing: EASE }));
    glow.value = withDelay(T.glow, withTiming(1, { duration: 900, easing: Easing.out(Easing.quad) }));
    // The same glint as the PRO badge, on the same beat: as the profile
    // opens, then every GLINT_EVERY_MS.
    glint.value = repeatingGlint();
    return () => cancelAnimation(glint);
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

  // A wider, softer band than the badge's, across the avatar's face.
  const bandWidth = size * 0.35;
  const glintStyle = useAnimatedStyle(() => ({
    opacity: glint.value > 0 && glint.value < 1 ? 1 : 0,
    transform: [{ translateX: -bandWidth + (size + bandWidth * 2) * glint.value }, { rotate: "20deg" }],
  }));

  const circle = { position: "absolute" as const, width: outer, height: outer, borderRadius: outer / 2 };
  return (
    <View style={{ width: outer, height: outer, alignItems: "center", justifyContent: "center" }}>
      <Animated.View pointerEvents="none" style={[circle, { backgroundColor: colors.accent }, glowStyle]} />
      <Animated.View pointerEvents="none" style={[circle, { borderWidth: RING.stroke, borderColor: colors.accent }, ringStyle]} />
      {children}
      {!reduceMotion && (
        // Clipped to the avatar's circle.
        <View pointerEvents="none" style={{ position: "absolute", width: size, height: size, borderRadius: size / 2, overflow: "hidden" }}>
          <Animated.View style={[{ position: "absolute", top: -size * 0.2, bottom: -size * 0.2, left: 0, width: bandWidth }, glintStyle]}>
            <LinearGradient colors={AVATAR_GLINT_BAND} start={{ x: 0, y: 0.5 }} end={{ x: 1, y: 0.5 }} style={{ flex: 1 }} />
          </Animated.View>
        </View>
      )}
    </View>
  );
}

// The glint: a narrow white band crossing the badge, as it pops in and then
// every 10 seconds.
const GLINT_MS = 520;
const GLINT_EVERY_MS = 10_000;
const GLINT_WIDTH = 14;
const GLINT_BAND = ["rgba(255,255,255,0)", "rgba(255,255,255,0.85)", "rgba(255,255,255,0)"] as const;
const AVATAR_GLINT_BAND = ["rgba(255,255,255,0)", "rgba(255,255,255,0.45)", "rgba(255,255,255,0)"] as const;

// The glint's timing, shared by the badge and the avatar so they shine
// together: across (hidden at the far edge), a rest, then back to the start
// while invisible; first as the profile opens.
function repeatingGlint() {
  return withDelay(
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
}

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
    // A glint as it pops in, then one every GLINT_EVERY_MS (in step with
    // the avatar's).
    glint.value = repeatingGlint();
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
