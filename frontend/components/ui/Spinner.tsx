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
  /** Wave only: curl the line into the spiral doodle at its right end. */
  done?: boolean;
  /** Wave only: called once the spiral has formed and held, so the parent
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

// The "done" flourish: the line reels into the spiral doodle at its right
// end while it spins, then the spiral pops (quick squash, then bursts
// outward and fades, with a ring of little ticks flying off), and Button
// brings its label back. Same spiral formula as DOODLES.spiral
// (a = 0..9.9 rad, r = 1.2 + a * 0.85 in a 24-unit box), scaled to
// SPIRAL_RADIUS px.
const SPIRAL_TURN = 9.9;
const SPIRAL_RADIUS = 10;
const SPIRAL_SCALE = SPIRAL_RADIUS / (1.2 + SPIRAL_TURN * 0.85);
const MORPH_MS = 750;
// How much the right end leads the left while curling (0 = all at once).
const MORPH_STAGGER = 0.6;
// Turns the spiral makes from the start of the curl to the end of the pop.
// Speeds up into the pop. Wound the way that reels the line in.
const SPIN_TURNS = 1.5;
const POP_MS = 280;
// Pop timeline (0..1): squash to POP_SQUASH by POP_SQUASH_AT, then grow to
// POP_GROW while fading out.
const POP_SQUASH_AT = 0.3;
const POP_SQUASH = 0.85;
const POP_GROW = 1.7;
const BURST_TICKS = 8;
// Furthest anything reaches from the spiral's center, in SPIRAL_RADIUS
// units (the popped spiral / burst ticks). Sizes the box so nothing clips.
const POP_EXTENT = 1.75;

const AnimatedPath = Animated.createAnimatedComponent(Path);

// A long wavy line spanning its parent's width, always WAVE_COUNT waves
// across. Drawn point by point every frame (not a fixed path slid sideways)
// so it can morph: phase loops 0 -> 1 and the sine makes the restart
// seamless. When `done` flips on, each point slides to its spot on the
// (spinning) spiral, right end first, so the line looks like it curls up.
function WaveSpinner({ size = 12, color = "#FFFFFF", done = false, onDone }: SpinnerProps) {
  const [width, setWidth] = useState(0);
  // The worklets below read width from this, not the state: a worklet keeps
  // the JS values it was first created with, so `width` there stays 0 and
  // the wavelength divides by zero (NaN path).
  const widthSV = useSharedValue(0);
  const phase = useSharedValue(0);
  const morph = useSharedValue(0);
  const spin = useSharedValue(0);
  const pop = useSharedValue(0);
  const boxHeight = Math.max(size, SPIRAL_RADIUS * POP_EXTENT * 2 + WAVE_STROKE_WIDTH);
  // Ref so a new inline onDone each parent render doesn't restart the timer.
  const onDoneRef = useRef(onDone);
  onDoneRef.current = onDone;

  useEffect(() => {
    phase.value = withRepeat(withTiming(1, { duration: WAVE_PERIOD_MS, easing: Easing.linear }), -1, false);
  }, [phase]);

  useEffect(() => {
    if (!done) {
      morph.value = 0;
      spin.value = 0;
      pop.value = 0;
      return;
    }
    morph.value = withTiming(1, { duration: MORPH_MS, easing: Easing.inOut(Easing.cubic) });
    spin.value = withTiming(SPIN_TURNS * 2 * Math.PI, { duration: MORPH_MS + POP_MS, easing: Easing.in(Easing.quad) });
    pop.value = withDelay(MORPH_MS, withTiming(1, { duration: POP_MS, easing: Easing.out(Easing.quad) }));
    const timer = setTimeout(() => onDoneRef.current?.(), MORPH_MS + POP_MS);
    return () => clearTimeout(timer);
  }, [done, morph, spin, pop]);

  const pathProps = useAnimatedProps(() => {
    const width = widthSV.value;
    if (width <= 0) return { d: "", strokeOpacity: 1 };
    const pad = WAVE_STROKE_WIDTH / 2;
    const mid = boxHeight / 2;
    const amplitude = size / 2 - pad;
    const waveLength = width / WAVE_COUNT;
    const spiralX = width - pad - SPIRAL_RADIUS * POP_EXTENT;
    const p = pop.value;
    const popScale =
      p < POP_SQUASH_AT
        ? 1 - (1 - POP_SQUASH) * (p / POP_SQUASH_AT)
        : POP_SQUASH + (POP_GROW - POP_SQUASH) * ((p - POP_SQUASH_AT) / (1 - POP_SQUASH_AT));
    const opacity = p < POP_SQUASH_AT ? 1 : 1 - (p - POP_SQUASH_AT) / (1 - POP_SQUASH_AT);
    let d = "";
    for (let i = 0; i < WAVE_POINTS; i++) {
      const t = i / (WAVE_POINTS - 1);
      // On the wave.
      const wx = pad + t * (width - pad * 2);
      const wy = mid - amplitude * Math.sin(2 * Math.PI * (wx / waveLength + phase.value));
      // On the spiral: the left end is the outer tail (pointing left, so it
      // still reads as the same line), the right end is the center. Angle
      // grows toward the center, which winds clockwise on screen (y points
      // down); spinning the same way reels the line in.
      const a = (1 - t) * SPIRAL_TURN;
      const r = (1.2 + a * 0.85) * SPIRAL_SCALE * popScale;
      const angle = Math.PI + (SPIRAL_TURN - a) + spin.value;
      const sx = spiralX + Math.cos(angle) * r;
      const sy = mid + Math.sin(angle) * r;
      const k = Math.min(1, Math.max(0, morph.value * (1 + MORPH_STAGGER) - (1 - t) * MORPH_STAGGER));
      const x = wx + (sx - wx) * k;
      const y = wy + (sy - wy) * k;
      d += `${i === 0 ? "M" : " L"}${x.toFixed(2)} ${y.toFixed(2)}`;
    }
    return { d, strokeOpacity: opacity };
  }, [size, boxHeight]);

  // The pop's burst: short ticks around the spiral that fly outward and
  // shrink to nothing, starting just as the squash releases.
  const burstProps = useAnimatedProps(() => {
    const width = widthSV.value;
    const b = Math.min(1, Math.max(0, (pop.value - POP_SQUASH_AT) / (1 - POP_SQUASH_AT)));
    if (width <= 0 || b <= 0) return { d: "", strokeOpacity: 0 };
    const cx = width - WAVE_STROKE_WIDTH / 2 - SPIRAL_RADIUS * POP_EXTENT;
    const cy = boxHeight / 2;
    const inner = SPIRAL_RADIUS * (1.2 + 0.5 * b);
    const outer = inner + SPIRAL_RADIUS * 0.5 * (1 - b);
    let d = "";
    for (let i = 0; i < BURST_TICKS; i++) {
      const angle = (i / BURST_TICKS) * 2 * Math.PI;
      const cos = Math.cos(angle);
      const sin = Math.sin(angle);
      d += `M${(cx + cos * inner).toFixed(2)} ${(cy + sin * inner).toFixed(2)} L${(cx + cos * outer).toFixed(2)} ${(cy + sin * outer).toFixed(2)} `;
    }
    return { d, strokeOpacity: 1 - b };
  }, [boxHeight]);

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
          <AnimatedPath
            animatedProps={burstProps}
            stroke={color}
            strokeWidth={WAVE_STROKE_WIDTH}
            strokeLinecap="round"
            fill="none"
          />
        </Svg>
      )}
    </View>
  );
}
