import { type ReactNode, type RefObject, useEffect, useState } from "react";
import { StyleSheet, View, type ViewInstance } from "react-native";
import Animated, { Easing, useAnimatedProps, useAnimatedStyle, useSharedValue, withDelay, withSequence, withTiming } from "react-native-reanimated";
import Svg, { Path } from "react-native-svg";
import { colors } from "@/frontend/constants/theme";

const AnimatedPath = Animated.createAnimatedComponent(Path);

// The intro's dot shrinks to this as it lands in the middle of the switch.
const LANDING_DOT = 4;
// The highlight lap: an orange line once round the pill's border, drawn on
// its own edge (same as Discover's Create button).
const LAP_STROKE = 2;
// Taking in the dot: a small swell with an orange wash, then the lap runs
// and fades. Eased, no spring (a wide pill swelling reads as a pop).
const SWELL = 1.04;
const SWELL_UP_MS = 140;
const SWELL_DOWN_MS = 320;
const FLUSH_PEAK = 0.3;
const FLUSH_MS = 450;
const LAP_DELAY_MS = 250;
const LAP_MS = 900;
const LAP_FADE_MS = 300;

// A pill outline starting at the top center, running clockwise, and its
// length (two straights and two half circles).
function pillPath(w: number, h: number) {
  const inset = LAP_STROKE / 2;
  const left = inset;
  const right = w - inset;
  const top = inset;
  const bottom = h - inset;
  const r = (bottom - top) / 2;
  const cx = w / 2;
  const d = [
    `M ${cx} ${top}`,
    `H ${right - r}`,
    `A ${r} ${r} 0 0 1 ${right - r} ${bottom}`,
    `H ${left + r}`,
    `A ${r} ${r} 0 0 1 ${left + r} ${top}`,
    "Z",
  ].join(" ");
  const length = 2 * Math.max(right - left - 2 * r, 0) + 2 * Math.PI * r;
  return { d, length };
}

type ModeSwitchLandingProps = {
  children: ReactNode;
  /** An invisible spot at the switch's center: where Home's welcome intro
   *  dot lands (see usePageIntro's targetRef). */
  landingRef: RefObject<ViewInstance | null>;
  /** Bumped once the dot has landed: the switch swells with an orange wash,
   *  then an orange line runs once round its border. */
  highlightId: number;
};

// Home's By Budget / By Pantry switch as the welcome intro's landing spot,
// taking the dot in like Discover's Create (+) button does.
export function ModeSwitchLanding({ children, landingRef, highlightId }: ModeSwitchLandingProps) {
  const [size, setSize] = useState<{ w: number; h: number } | null>(null);
  const pill = size ? pillPath(size.w, size.h) : null;
  const length = pill?.length ?? 1;
  const swell = useSharedValue(1);
  const flush = useSharedValue(0);
  const lap = useSharedValue(0);
  const lapOpacity = useSharedValue(0);

  useEffect(() => {
    if (highlightId === 0) return;
    swell.value = withSequence(
      withTiming(SWELL, { duration: SWELL_UP_MS, easing: Easing.out(Easing.quad) }),
      withTiming(1, { duration: SWELL_DOWN_MS, easing: Easing.inOut(Easing.cubic) }),
    );
    flush.value = withSequence(withTiming(FLUSH_PEAK, { duration: SWELL_UP_MS }), withTiming(0, { duration: FLUSH_MS, easing: Easing.out(Easing.quad) }));
    lap.value = 0;
    lap.value = withDelay(LAP_DELAY_MS, withTiming(1, { duration: LAP_MS, easing: Easing.inOut(Easing.quad) }));
    lapOpacity.value = withSequence(withTiming(1, { duration: 0 }), withDelay(LAP_DELAY_MS + LAP_MS, withTiming(0, { duration: LAP_FADE_MS })));
  }, [highlightId]);

  const swellStyle = useAnimatedStyle(() => ({ transform: [{ scale: swell.value }] }));
  const flushStyle = useAnimatedStyle(() => ({ opacity: flush.value }));
  const lapProps = useAnimatedProps(() => ({
    strokeDashoffset: length * (1 - lap.value),
    strokeOpacity: lapOpacity.value,
  }));

  return (
    <Animated.View style={swellStyle} onLayout={(e) => setSize({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height })}>
      {children}
      {/* The orange wash as the switch takes in the dot (over the labels,
          light enough to read through). */}
      <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, { borderRadius: 999, backgroundColor: colors.accent }, flushStyle]} />
      <View pointerEvents="none" style={[StyleSheet.absoluteFill, { alignItems: "center", justifyContent: "center" }]}>
        <View ref={landingRef} collapsable={false} style={{ width: LANDING_DOT, height: LANDING_DOT }} />
      </View>
      {size && pill && (
        <Svg pointerEvents="none" width={size.w} height={size.h} style={{ position: "absolute", top: 0, left: 0 }}>
          <AnimatedPath
            d={pill.d}
            fill="none"
            stroke={colors.accent}
            strokeWidth={LAP_STROKE}
            strokeLinecap="round"
            strokeDasharray={[length, length]}
            strokeOpacity={0}
            animatedProps={lapProps}
          />
        </Svg>
      )}
    </Animated.View>
  );
}
