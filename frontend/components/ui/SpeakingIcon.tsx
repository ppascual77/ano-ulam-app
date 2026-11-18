import { useEffect, useMemo, useRef } from "react";
import { View } from "react-native";
import Animated, {
  Easing,
  cancelAnimation,
  useAnimatedProps,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from "react-native-reanimated";
import Svg, { Path } from "react-native-svg";
import { Volume2 } from "lucide-react-native";

// A speaker that shows it's talking, in the app's hand-drawn way: the volume
// icon, morphing while `speaking` into a tangle of thin scribbled loops (one
// continuous line looping over itself, like a pen doodling) that keeps
// re-forming, slowly turns and gently breathes, and back to the icon when it
// stops. Each tangle is drawn from its own random loops, so no two look the
// same. Eased, no pops. Put it inside its own button or circle; it only
// draws the glyph. Reduce motion: pass speaking={false} for the plain icon.

const AnimatedPath = Animated.createAnimatedComponent(Path);

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

function Tangle({ speaking, radius, color }: { speaking: boolean; radius: number; color: string }) {
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

  const box = radius * 2 + STROKE * 2;
  const c = box / 2;
  const pathProps = useAnimatedProps(() => {
    const phase = drift.value * Math.PI * 2;
    let d = "";
    for (let i = 0; i < POINTS; i++) {
      const t = (i / POINTS) * Math.PI * 2;
      let x = 0;
      let y = 0;
      for (let k = 0; k < terms.length; k++) {
        const term = terms[k];
        x += term.ax * Math.sin(term.fx * t + term.px + term.drift * phase);
        y += term.ay * Math.cos(term.fy * t + term.py - term.drift * phase);
      }
      d += `${i === 0 ? "M" : " L"}${(c + x * radius).toFixed(2)} ${(c + y * radius).toFixed(2)}`;
    }
    return { d: `${d} Z` };
  }, [terms, radius]);
  const style = useAnimatedStyle(() => ({ transform: [{ rotate: `${turn.value * 360}deg` }, { scale: voice.value }] }));

  return (
    <Animated.View style={[{ width: box, height: box }, style]}>
      <Svg width={box} height={box}>
        <AnimatedPath animatedProps={pathProps} fill="none" stroke={color} strokeWidth={STROKE} strokeLinejoin="round" strokeLinecap="round" />
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
