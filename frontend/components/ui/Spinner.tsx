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
import Svg, { Path } from "react-native-svg";
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
  /** Wave only: straighten the line, pull it taut from both ends and snap
   *  it in the middle. */
  done?: boolean;
  /** Wave only: called the moment the line snaps (e.g. to burst confetti
   *  from its middle). */
  onSnap?: () => void;
  /** Wave only: called once the snapped halves have faded, so the parent
   *  can take the spinner away. */
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

// The "done" outro, a string pulled taut until it snaps: the wiggle calms
// into a straight string, both ends get pulled outward (opposite ways) and
// it thins under the tension, then it snaps in the middle, the two halves
// whipping back to the ends and fading. Button fires confetti from the break
// (onSnap). Replaced a curl into the spiral doodle, which read as a
// different object from the wave.
const STRAIGHTEN_MS = 220;
const PULL_MS = 280;
const SNAP_MS = 240;
// How far each end is pulled outward, in px. The wave runs this far in from
// each side so the pull has room.
const PULL_PX = 6;
// The stroke at full tension, thinner than WAVE_STROKE_WIDTH.
const TAUT_STROKE_WIDTH = 1.3;

const AnimatedPath = Animated.createAnimatedComponent(Path);

// A long wavy line spanning its parent's width, always WAVE_COUNT waves
// across. Drawn point by point every frame (not a fixed path slid sideways)
// so it can change shape: phase loops 0 -> 1 and the sine makes the restart
// seamless. When `done` flips on: calm, pull taut, snap (see STRAIGHTEN_MS).
function WaveSpinner({ size = 12, color = "#FFFFFF", done = false, onDone, onSnap }: SpinnerProps) {
  const [width, setWidth] = useState(0);
  // The worklets below read width from this, not the state: a worklet keeps
  // the JS values it was first created with, so `width` there stays 0 and
  // the wavelength divides by zero (NaN path).
  const widthSV = useSharedValue(0);
  const phase = useSharedValue(0);
  const calm = useSharedValue(0);
  const pull = useSharedValue(0);
  const snap = useSharedValue(0);
  const boxHeight = size;
  // Refs so new inline callbacks each parent render don't restart the timers.
  const onDoneRef = useRef(onDone);
  onDoneRef.current = onDone;
  const onSnapRef = useRef(onSnap);
  onSnapRef.current = onSnap;

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
    pull.value = withDelay(STRAIGHTEN_MS, withTiming(1, { duration: PULL_MS, easing: Easing.in(Easing.quad) }));
    snap.value = withDelay(STRAIGHTEN_MS + PULL_MS, withTiming(1, { duration: SNAP_MS, easing: Easing.out(Easing.cubic) }));
    const timers = [
      setTimeout(() => onSnapRef.current?.(), STRAIGHTEN_MS + PULL_MS),
      setTimeout(() => onDoneRef.current?.(), STRAIGHTEN_MS + PULL_MS + SNAP_MS),
    ];
    return () => timers.forEach(clearTimeout);
  }, [done, calm, pull, snap]);

  const pathProps = useAnimatedProps(() => {
    const width = widthSV.value;
    if (width <= 0) return { d: "", strokeWidth: WAVE_STROKE_WIDTH, strokeOpacity: 1 };
    const pad = WAVE_STROKE_WIDTH / 2;
    const mid = boxHeight / 2;
    const center = width / 2;
    const amplitude = (size / 2 - pad) * (1 - calm.value);
    const waveLength = width / WAVE_COUNT;
    // The ends: PULL_PX in from the sides, pulled out to the sides.
    const reach = pad + PULL_PX * (1 - pull.value);
    const left = reach;
    const right = width - reach;
    // After the snap each half's broken end whips back to its own side.
    const s = snap.value;
    let d = "";
    const half = WAVE_POINTS / 2;
    for (let i = 0; i < WAVE_POINTS; i++) {
      const t = i / (WAVE_POINTS - 1);
      let x = left + t * (right - left);
      if (s > 0) {
        // Squeeze each half toward its outer end.
        x = x < center ? left + (x - left) * (1 - s) : right - (right - x) * (1 - s);
      }
      const y = mid - amplitude * Math.sin(2 * Math.PI * (x / waveLength + phase.value));
      // Two strokes once snapped: start the right half fresh.
      d += `${i === 0 || (s > 0 && i === half) ? "M" : " L"}${x.toFixed(2)} ${y.toFixed(2)}`;
    }
    return {
      d,
      strokeWidth: WAVE_STROKE_WIDTH + (TAUT_STROKE_WIDTH - WAVE_STROKE_WIDTH) * pull.value * (1 - s),
      strokeOpacity: 1 - s,
    };
  }, [size, boxHeight]);

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
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
          />
        </Svg>
      )}
    </View>
  );
}
