import { useEffect, useRef, useState } from "react";
import { View } from "react-native";
import Animated, {
  Easing,
  useAnimatedProps,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withTiming,
} from "react-native-reanimated";
import Svg, { Circle, Path } from "react-native-svg";
import { BoilingDoodle, DOODLES, drawBoilPair } from "./doodles";

type SpinnerProps = {
  /** "ring" (default) is the web app's spinner; "spiral" is the hand-drawn
   *  spiral doodle from Confetti, spinning (e.g. the meal detail's Save);
   *  "wave" is a long squiggle that fills its parent's width and keeps
   *  rolling sideways (Button's loading state). */
  variant?: "ring" | "spiral" | "wave";
  /** Diameter in px (ring/spiral) or line height in px (wave). Defaults to
   *  32 (the web app's page spinner, h-8 w-8). */
  size?: number;
  /** Ring thickness in px. Defaults to 2. Ring only. */
  thickness?: number;
  /** The bright arc (ring) or the doodle's stroke (spiral). Defaults to white
   *  (for dark backgrounds). */
  color?: string;
  /** The faint full ring behind it. Defaults to 20% white. Ring only. */
  trackColor?: string;
  /** Wave only: straighten the line, pull it in to its middle and snap it
   *  into a dot. */
  done?: boolean;
  /** Wave only: called as the line snaps into its dot, so the parent can
   *  take the spinner away (and burst confetti from there). */
  onDone?: () => void;
};

function useSpin(durationMs: number) {
  const rotation = useSharedValue(0);

  useEffect(() => {
    rotation.value = withRepeat(withTiming(360, { duration: durationMs, easing: Easing.linear }), -1, false);
  }, [rotation, durationMs]);

  return useAnimatedStyle(() => ({ transform: [{ rotate: `${rotation.value}deg` }] }));
}

export function Spinner({ variant = "ring", ...props }: SpinnerProps) {
  if (variant === "spiral") return <SpiralSpinner {...props} />;
  if (variant === "wave") return <WaveSpinner {...props} />;
  return <RingSpinner {...props} />;
}

// Ring spinner ported from the web app (`animate-spin rounded-full border-2
// border-white/20 border-t-white`): a faint track with one bright top arc,
// rotating. Used where the web uses it (Discover's loading screen, the
// like/save buttons) instead of the platform ActivityIndicator, which looks
// different on iOS and Android.
function RingSpinner({ size = 32, thickness = 2, color = "#FFFFFF", trackColor = "rgba(255,255,255,0.2)" }: SpinnerProps) {
  const style = useSpin(1000);

  return (
    <Animated.View
      accessibilityRole="progressbar"
      accessibilityLabel="Loading"
      style={[
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          borderWidth: thickness,
          borderColor: trackColor,
          borderTopColor: color,
        },
        style,
      ]}
    />
  );
}

// Thinner than the confetti doodles' 2.4 (viewBox units), so the spinner
// reads lighter inside buttons and inputs.
const SPIRAL_STROKE_WIDTH = 1.7;

// The spiral doodle spinning, with the same two-version "line boil" as the
// confetti pieces so it reads as hand-drawn.
function SpiralSpinner({ size = 32, color = "#FFFFFF" }: SpinnerProps) {
  const spin = useSpin(900);
  const [versions] = useState(() => drawBoilPair(DOODLES.spiral));

  return (
    <Animated.View accessibilityRole="progressbar" accessibilityLabel="Loading" style={spin}>
      <BoilingDoodle versions={versions} size={size} color={color} strokeWidth={SPIRAL_STROKE_WIDTH} />
    </Animated.View>
  );
}

// How many full waves span the line, how long one takes to roll past, and
// the stroke thickness. The wavelength itself comes from the measured width.
const WAVE_COUNT = 3;
const WAVE_PERIOD_MS = 1100;
const WAVE_STROKE_WIDTH = 2.5;
// Points the line is drawn through. Enough that the wave reads smooth.
const WAVE_POINTS = 120;

// The "done" outro, all one line coming to rest: the wiggle calms into a
// straight line, the line pulls in from both ends to its middle, and what's
// left snaps into a dot (Button bursts confetti from it as the label comes
// back). Replaced a curl into the spiral doodle, which read as a different
// object from the wave.
const STRAIGHTEN_MS = 240;
const PULL_MS = 300;
const SNAP_MS = 160;
// The dot it snaps into, in px.
const DOT_RADIUS = 3.5;

const AnimatedPath = Animated.createAnimatedComponent(Path);
const AnimatedCircle = Animated.createAnimatedComponent(Circle);

// A long wavy line spanning its parent's width, always WAVE_COUNT waves
// across. Drawn point by point every frame (not a fixed path slid sideways)
// so it can change shape: phase loops 0 -> 1 and the sine makes the restart
// seamless. When `done` flips on: calm, pull in, snap (see STRAIGHTEN_MS).
function WaveSpinner({ size = 12, color = "#FFFFFF", done = false, onDone }: SpinnerProps) {
  const [width, setWidth] = useState(0);
  // The worklets below read width from this, not the state: a worklet keeps
  // the JS values it was first created with, so `width` there stays 0 and
  // the wavelength divides by zero (NaN path).
  const widthSV = useSharedValue(0);
  const phase = useSharedValue(0);
  const calm = useSharedValue(0);
  const pull = useSharedValue(0);
  const snap = useSharedValue(0);
  const boxHeight = Math.max(size, DOT_RADIUS * 2 + WAVE_STROKE_WIDTH);
  // Ref so a new inline onDone each parent render doesn't restart the timer.
  const onDoneRef = useRef(onDone);
  onDoneRef.current = onDone;

  useEffect(() => {
    phase.value = withRepeat(withTiming(1, { duration: WAVE_PERIOD_MS, easing: Easing.linear }), -1, false);
  }, [phase]);

  useEffect(() => {
    if (!done) {
      calm.value = 0;
      pull.value = 0;
      snap.value = 0;
      return;
    }
    calm.value = withTiming(1, { duration: STRAIGHTEN_MS, easing: Easing.out(Easing.cubic) });
    pull.value = withDelay(STRAIGHTEN_MS, withTiming(1, { duration: PULL_MS, easing: Easing.in(Easing.cubic) }));
    snap.value = withDelay(STRAIGHTEN_MS + PULL_MS, withTiming(1, { duration: SNAP_MS, easing: Easing.out(Easing.back(3)) }));
    const timer = setTimeout(() => onDoneRef.current?.(), STRAIGHTEN_MS + PULL_MS + SNAP_MS);
    return () => clearTimeout(timer);
  }, [done, calm, pull, snap]);

  const pathProps = useAnimatedProps(() => {
    const width = widthSV.value;
    if (width <= 0 || pull.value >= 1) return { d: "" };
    const pad = WAVE_STROKE_WIDTH / 2;
    const mid = boxHeight / 2;
    const center = width / 2;
    const amplitude = (size / 2 - pad) * (1 - calm.value);
    const waveLength = width / WAVE_COUNT;
    const reach = 1 - pull.value;
    let d = "";
    for (let i = 0; i < WAVE_POINTS; i++) {
      const t = i / (WAVE_POINTS - 1);
      const wx = pad + t * (width - pad * 2);
      const y = mid - amplitude * Math.sin(2 * Math.PI * (wx / waveLength + phase.value));
      // Both ends close in on the middle.
      const x = center + (wx - center) * reach;
      d += `${i === 0 ? "M" : " L"}${x.toFixed(2)} ${y.toFixed(2)}`;
    }
    return { d };
  }, [size, boxHeight]);

  // The dot the line snaps into: from the stroke's own width to DOT_RADIUS,
  // overshooting a little (the snap).
  const dotProps = useAnimatedProps(() => ({
    cx: widthSV.value / 2,
    r: pull.value >= 1 ? WAVE_STROKE_WIDTH / 2 + (DOT_RADIUS - WAVE_STROKE_WIDTH / 2) * snap.value : 0,
  }));

  return (
    <View
      accessibilityRole="progressbar"
      accessibilityLabel="Loading"
      className="self-stretch"
      style={{ height: boxHeight }}
      onLayout={(e) => {
        widthSV.value = e.nativeEvent.layout.width;
        setWidth(e.nativeEvent.layout.width);
      }}
    >
      {width > 0 && (
        <Svg width={width} height={boxHeight}>
          <AnimatedPath
            animatedProps={pathProps}
            stroke={color}
            strokeWidth={WAVE_STROKE_WIDTH}
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
          />
          <AnimatedCircle animatedProps={dotProps} cy={boxHeight / 2} fill={color} />
        </Svg>
      )}
    </View>
  );
}
