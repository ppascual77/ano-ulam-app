import { type RefObject, useEffect, useState } from "react";
import { type ViewInstance } from "react-native";
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import { scheduleOnRN } from "react-native-worklets";
import { colors } from "@/frontend/constants/theme";

// The numbers explainer's dot handoff: "Got it" shrinks to an orange dot
// (NumbersExplainerSheet), which is tossed back up to "Plan your meals."
// and lands as its period, with a little pulse (OnboardingScreen).

// About the size of text-hero's "." glyph, which this stands in for.
export const PERIOD_DOT = 12;
// Flights are ballistic: one constant gravity the whole way, so the time
// up and the time down come from the heights (a longer fall takes longer),
// with steady sideways speed. G is in px/s².
const G = 4200;
// How far above the higher end a flight peaks.
const LIFT = 80;

export type DotPoint = { x: number; y: number; size: number };

type PeriodDotProps = {
  dotRef: RefObject<ViewInstance | null>;
  /** Hidden while the flying dot is on its way to it. */
  hidden: boolean;
  /** Bumped on each landing: pulses once. */
  pulse: number;
};

// The title's period as a real (measurable) dot, which HeroTitle places
// exactly over its "." glyph.
export function PeriodDot({ dotRef, hidden, pulse }: PeriodDotProps) {
  const scale = useSharedValue(1);
  useEffect(() => {
    if (pulse === 0) return;
    scale.value = withSequence(withTiming(1.7, { duration: 130, easing: Easing.out(Easing.quad) }), withSpring(1, { damping: 7, stiffness: 240, mass: 0.5 }));
  }, [pulse, scale]);
  const style = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  return (
    <Animated.View
      ref={dotRef}
      collapsable={false}
      style={[
        { width: PERIOD_DOT, height: PERIOD_DOT, borderRadius: PERIOD_DOT / 2, backgroundColor: colors.accent, opacity: hidden ? 0 : 1 },
        style,
      ]}
    />
  );
}

type FlyingDotProps = {
  from: DotPoint;
  /** Where it lands: a known point, or a view measured at take-off. */
  to?: DotPoint;
  targetRef?: RefObject<ViewInstance | null>;
  onLand: () => void;
};

// A view's center and size in window coordinates, or null if it can't be
// measured (not laid out, or already gone).
export function measureDot(ref: RefObject<ViewInstance | null>, done: (point: DotPoint | null) => void) {
  const node = ref.current;
  if (!node) return done(null);
  node.measureInWindow((x, y, w, h) => done(w ? { x: x + w / 2, y: y + h / 2, size: w } : null));
}

// Drawn over everything (the sheet too) in window coordinates: the
// onboarding screen fills the window from its top-left corner.
export function FlyingDot({ from, to: knownTo, targetRef, onLand }: FlyingDotProps) {
  const [measuredTo, setMeasuredTo] = useState<DotPoint | null>(null);
  useEffect(() => {
    if (knownTo || !targetRef) return;
    measureDot(targetRef, (point) => (point ? setMeasuredTo(point) : onLand()));
    // Measured once, at take-off.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const to = knownTo ?? measuredTo;

  // Up-time and down-time from the heights, under one gravity.
  const [flight, setFlight] = useState<{ to: DotPoint; peak: number; up: number; down: number } | null>(null);
  useEffect(() => {
    if (!to || flight) return;
    const peak = Math.min(from.y, to.y) - LIFT;
    setFlight({ to, peak, up: Math.sqrt((2 * (from.y - peak)) / G), down: Math.sqrt((2 * (to.y - peak)) / G) });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [to]);

  // The clock, in seconds since take-off.
  const time = useSharedValue(0);
  useEffect(() => {
    if (!flight) return;
    const total = flight.up + flight.down;
    time.value = withTiming(total, { duration: total * 1000, easing: Easing.linear }, (finished) => {
      if (finished) scheduleOnRN(onLand);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [flight]);

  const style = useAnimatedStyle(() => {
    if (!flight) {
      return { width: from.size, height: from.size, borderRadius: from.size / 2, transform: [{ translateX: from.x - from.size / 2 }, { translateY: from.y - from.size / 2 }] };
    }
    const t = time.value;
    const total = flight.up + flight.down;
    const u = t / total;
    // Up: decelerating to the peak. Down: accelerating from it. Both are
    // the same parabola, so it's smooth over the top.
    const y =
      t <= flight.up
        ? flight.peak + (from.y - flight.peak) * Math.pow(1 - t / flight.up, 2)
        : flight.peak + (flight.to.y - flight.peak) * Math.pow((t - flight.up) / flight.down, 2);
    const x = from.x + (flight.to.x - from.x) * u;
    const size = from.size + (flight.to.size - from.size) * u;
    return { width: size, height: size, borderRadius: size / 2, transform: [{ translateX: x - size / 2 }, { translateY: y - size / 2 }] };
  });

  return <Animated.View pointerEvents="none" style={[{ position: "absolute", left: 0, top: 0, backgroundColor: colors.accent }, style]} />;
}
