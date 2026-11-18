import { useEffect, useMemo, useRef } from "react";
import { View } from "react-native";
import Animated, {
  Easing,
  cancelAnimation,
  interpolate,
  useAnimatedProps,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
  type SharedValue,
} from "react-native-reanimated";
import Svg, { Circle, Path } from "react-native-svg";
import { Volume2 } from "lucide-react-native";

// A speaker that shows it's talking, in the app's hand-drawn way: the volume
// icon, morphing while `speaking` into a tangle of thin scribbled loops (one
// continuous line looping over itself, like a pen doodling) that keeps
// re-forming, slowly turns and gently breathes, and back to the icon when it
// stops. Each tangle is drawn from its own random loops, so no two look the
// same. Eased, no pops. Put it inside its own button or circle; it only
// draws the glyph. Reduce motion: pass speaking={false} for the plain icon.

const AnimatedPath = Animated.createAnimatedComponent(Path);
const AnimatedCircle = Animated.createAnimatedComponent(Circle);

const MORPH_MS = 240;
// One full drift of the loops (seamless: it comes back to where it began).
const DRIFT_MS = 14000;
// One full turn.
const TURN_MS = 9000;
// Points along the line: enough for smooth loops even when tightly packed.
const POINTS = 280;
// The loops: several circular motions of different speeds added together
// (more terms and faster ones pack the tangle tighter). Whole-number speeds
// so the line closes on itself.
const TERMS = 6;
// How much each term's loops drift over one DRIFT_MS (whole numbers, so the
// drift is seamless).
const DRIFT_SPEEDS = [1, -1, 2, -2, 3, -3];

// The voice: a stream of syllables, each a quick thump up that drops below
// rest and recovers, with random strength and length (some brief, some
// long), and now and then a longer pause between words where it settles.
// Twice-as-fast timings were tried and read worse than these (Patrick,
// 2026-11-18).
const THUMP_UP_MS = [60, 110] as const;
const THUMP_DOWN_MS = [110, 320] as const;
const THUMP_PEAK = [1.1, 1.32] as const;
const THUMP_LOW = [0.82, 0.94] as const;
const SYLLABLE_GAP_MS = [30, 180] as const;
const WORD_GAP_MS = [280, 540] as const;
const WORD_GAP_CHANCE = 0.2;
const between = ([a, b]: readonly [number, number]) => a + Math.random() * (b - a);
const STROKE = 1.1;

type Term = { ax: number; ay: number; fx: number; fy: number; px: number; py: number; drift: number };

function randomTangle(): Term[] {
  const terms: Term[] = [];
  for (let k = 0; k < TERMS; k++) {
    terms.push({
      // Bigger, slower loops first; many small fast ones pack the scribble
      // tight (amplitudes fall off slowly, so the small loops show).
      ax: (1 / Math.sqrt(k + 1)) * (0.7 + Math.random() * 0.6),
      ay: (1 / Math.sqrt(k + 1)) * (0.7 + Math.random() * 0.6),
      // Whole numbers (the line must close), spaced about 2.75 apart: tuned
      // by eye between too airy (2.5) and too packed (3) (Patrick, 2026-11-18).
      fx: Math.round(2 + k * 2.75 + Math.random() * 3.5),
      fy: Math.round(2 + k * 2.75 + Math.random() * 3.5),
      px: Math.random() * Math.PI * 2,
      py: Math.random() * Math.PI * 2,
      drift: DRIFT_SPEEDS[k % DRIFT_SPEEDS.length],
    });
  }
  // Scaled so the tangle never leaves its circle.
  const sx = terms.reduce((n, t) => n + t.ax, 0);
  const sy = terms.reduce((n, t) => n + t.ay, 0);
  return terms.map((t) => ({ ...t, ax: t.ax / sx, ay: t.ay / sy }));
}

function Tangle({
  speaking,
  radius,
  color,
  stroke = STROKE,
  draw,
  points = POINTS,
  bulge = 1,
}: {
  speaking: boolean;
  radius: number;
  color: string;
  stroke?: number;
  /** 0..1: how much of the line is drawn, like a pen going round it. The whole line if left out. */
  draw?: SharedValue<number>;
  /** Points along the line (more for a bigger tangle, so the loops stay smooth). */
  points?: number;
  /** Below 1 pushes the line out toward the rim, the way a ball of yarn's
   * threads pile up at its edge, so it reads as a sphere rather than a flat
   * doodle (1: flat, as summed). */
  bulge?: number;
}) {
  // A fresh tangle each time it starts speaking (kept while it fades back
  // to the icon, so the shape doesn't jump mid-fade).
  const startCount = useRef(0);
  const wasSpeaking = useRef(speaking);
  if (speaking && !wasSpeaking.current) startCount.current += 1;
  wasSpeaking.current = speaking;
  const terms = useMemo(randomTangle, [startCount.current]);
  const drift = useSharedValue(0);
  const turn = useSharedValue(0);
  const voice = useSharedValue(1);
  // The voice's thumps, scheduled one syllable at a time while speaking.
  useEffect(() => {
    if (!speaking) {
      cancelAnimation(voice);
      voice.value = withTiming(1, { duration: 160 });
      return;
    }
    let timer: ReturnType<typeof setTimeout>;
    const syllable = () => {
      const up = between(THUMP_UP_MS);
      const down = between(THUMP_DOWN_MS);
      const wordGap = Math.random() < WORD_GAP_CHANCE;
      const gap = wordGap ? between(WORD_GAP_MS) : between(SYLLABLE_GAP_MS);
      voice.value = withSequence(
        withTiming(between(THUMP_PEAK), { duration: up, easing: Easing.out(Easing.quad) }),
        withTiming(between(THUMP_LOW), { duration: down, easing: Easing.inOut(Easing.quad) }),
        // Between words it settles back to rest; between syllables it
        // stays low, ready for the next thump.
        withTiming(wordGap ? 1 : between(THUMP_LOW), { duration: gap, easing: Easing.inOut(Easing.quad) }),
      );
      timer = setTimeout(syllable, up + down + gap);
    };
    syllable();
    return () => clearTimeout(timer);
  }, [speaking]);
  useEffect(() => {
    if (!speaking) {
      cancelAnimation(drift);
      cancelAnimation(turn);
      return;
    }
    drift.value = 0;
    turn.value = 0;
    drift.value = withRepeat(withTiming(1, { duration: DRIFT_MS, easing: Easing.linear }), -1, false);
    turn.value = withRepeat(withTiming(1, { duration: TURN_MS, easing: Easing.linear }), -1, false);
  }, [speaking]);

  const box = radius * 2 + stroke * 2;
  const c = box / 2;
  const pathProps = useAnimatedProps(() => {
    const phase = drift.value * Math.PI * 2;
    const drawn = draw ? Math.min(1, Math.max(0, draw.value)) : 1;
    const count = Math.ceil(drawn * points);
    if (count < 2) return { d: "" };
    let d = "";
    for (let i = 0; i < count; i++) {
      const t = (i / points) * Math.PI * 2;
      let x = 0;
      let y = 0;
      for (let k = 0; k < terms.length; k++) {
        const term = terms[k];
        x += term.ax * Math.sin(term.fx * t + term.px + term.drift * phase);
        y += term.ay * Math.cos(term.fy * t + term.py - term.drift * phase);
      }
      if (bulge !== 1) {
        const r = Math.sqrt(x * x + y * y);
        if (r > 0) {
          // Kept inside the circle.
          const f = Math.min(Math.pow(r, bulge), 1) / r;
          x *= f;
          y *= f;
        }
      }
      d += `${i === 0 ? "M" : " L"}${(c + x * radius).toFixed(2)} ${(c + y * radius).toFixed(2)}`;
    }
    return { d: count >= points ? `${d} Z` : d };
  }, [terms, radius, stroke, draw, points, bulge]);
  const style = useAnimatedStyle(() => ({ transform: [{ rotate: `${turn.value * 360}deg` }, { scale: voice.value }] }));

  return (
    <Animated.View style={[{ width: box, height: box }, style]}>
      <Svg width={box} height={box}>
        <AnimatedPath animatedProps={pathProps} fill="none" stroke={color} strokeWidth={stroke} strokeLinejoin="round" strokeLinecap="round" />
      </Svg>
    </Animated.View>
  );
}

export function SpeakingIcon({ speaking, size = 16, color }: { speaking: boolean; /** The icon's size; the tangle scales with it. */ size?: number; color: string }) {
  // The tangle sits inside the circle the icon is in (about 1.3x the icon
  // across), with room for the thumps to grow.
  const radius = size * 0.66;
  const box = Math.max(size + 4, radius * 2 + STROKE * 2);
  // 0: the volume icon, 1: the tangle.
  const morph = useSharedValue(speaking ? 1 : 0);
  useEffect(() => {
    morph.value = withTiming(speaking ? 1 : 0, { duration: MORPH_MS, easing: Easing.inOut(Easing.cubic) });
  }, [speaking]);
  const iconStyle = useAnimatedStyle(() => ({ opacity: 1 - morph.value, transform: [{ scale: 1 - 0.4 * morph.value }] }));
  const tangleStyle = useAnimatedStyle(() => ({ opacity: morph.value, transform: [{ scale: 0.6 + 0.4 * morph.value }] }));
  return (
    <View style={{ width: box, height: box, alignItems: "center", justifyContent: "center" }}>
      <Animated.View style={[{ position: "absolute" }, iconStyle]}>
        <Volume2 color={color} size={size} />
      </Animated.View>
      <Animated.View style={[{ position: "absolute" }, tangleStyle]}>
        <Tangle speaking={speaking} radius={radius} color={color} />
      </Animated.View>
    </View>
  );
}

// The voice orb (cook mode, under the step): a resting dot that, when the
// voice starts, quickly draws itself out into the same scribbled tangle as
// the speaker icon (one pen stroke) while a circle draws itself round it,
// then keeps the icon's motion:
// re-forming loops, a slow turn, a thump with each syllable. When the voice
// stops, the line and circle wind back up and the dot returns. Reduce motion: pass
// speaking={false} and it stays a dot.
const DRAW_IN_MS = 520;
const DRAW_OUT_MS = 320;
const ORB_DOT = 14;
const ORB_STROKE = 1.6;
// A rounder, fuller tangle than the icon's, so the orb reads as a sphere.
const ORB_POINTS = 420;
const ORB_BULGE = 0.55;

export function VoiceOrb({ speaking, size = 100, color }: { speaking: boolean; /** Across, with room for the thumps. */ size?: number; color: string }) {
  // The circle at the edge; the tangle inside it, with room for its loudest
  // thump plus a little air before the circle.
  const ring = size / 2 - ORB_STROKE;
  const radius = (ring * 0.85) / THUMP_PEAK[1];
  const circumference = 2 * Math.PI * ring;
  const draw = useSharedValue(speaking ? 1 : 0);
  useEffect(() => {
    draw.value = withTiming(speaking ? 1 : 0, {
      duration: speaking ? DRAW_IN_MS : DRAW_OUT_MS,
      easing: speaking ? Easing.out(Easing.cubic) : Easing.inOut(Easing.cubic),
    });
  }, [speaking]);
  // The dot gives way as the pen starts, and comes back as the line winds up.
  const dotStyle = useAnimatedStyle(() => ({
    opacity: interpolate(draw.value, [0, 0.25], [1, 0], "clamp"),
    transform: [{ scale: interpolate(draw.value, [0, 0.25], [1, 0.4], "clamp") }],
  }));
  // The circle draws round from the top, alongside the tangle.
  const ringProps = useAnimatedProps(() => ({
    strokeDashoffset: circumference * (1 - Math.min(1, Math.max(0, draw.value))),
    // Hidden at rest: a round cap on an empty stroke would still show a speck.
    strokeOpacity: draw.value > 0.01 ? 1 : 0,
  }));
  return (
    <View style={{ width: size, height: size, alignItems: "center", justifyContent: "center" }}>
      <Svg width={size} height={size} style={{ position: "absolute", transform: [{ rotate: "-90deg" }] }}>
        <AnimatedCircle
          cx={size / 2}
          cy={size / 2}
          r={ring}
          fill="none"
          stroke={color}
          strokeWidth={ORB_STROKE}
          strokeLinecap="round"
          strokeDasharray={[circumference, circumference]}
          animatedProps={ringProps}
        />
      </Svg>
      <Animated.View style={[{ position: "absolute", width: ORB_DOT, height: ORB_DOT, borderRadius: ORB_DOT / 2, backgroundColor: color }, dotStyle]} />
      <View style={{ position: "absolute" }}>
        <Tangle speaking={speaking} radius={radius} color={color} stroke={ORB_STROKE} draw={draw} points={ORB_POINTS} bulge={ORB_BULGE} />
      </View>
    </View>
  );
}
