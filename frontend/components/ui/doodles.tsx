import { useEffect } from "react";
import { View } from "react-native";
import Animated, { Easing, useAnimatedStyle, useSharedValue, withRepeat, withTiming } from "react-native-reanimated";
import Svg, { Circle, Path } from "react-native-svg";
import { colors } from "@/frontend/constants/theme";

// Hand-drawn doodles from the onboarding intro.gif (triangle, star, spiral,
// circle, zigzags, dots), shared by Confetti's pieces and Spinner's "spiral"
// variant. Drawn in a 24x24 viewBox.

// How far (in viewBox units) each point wanders between hand-drawn versions.
const JITTER = 0.8;
const STROKE_WIDTH = 2.4;

type Point = [number, number];
export type Doodle = {
  strokes: { points: Point[]; closed?: boolean }[];
  dots?: (readonly [number, number, number])[];
  filled?: boolean;
};

function ring(cx: number, cy: number, r: number, steps: number): Point[] {
  return Array.from({ length: steps }, (_, i) => {
    const a = (i / steps) * Math.PI * 2;
    return [cx + Math.cos(a) * r, cy + Math.sin(a) * r];
  });
}

export const DOODLES = {
  triangle: { strokes: [{ points: [[6, 4], [20, 12], [6, 20]], closed: true }], filled: true },
  star: {
    strokes: [
      {
        points: Array.from({ length: 10 }, (_, i) => {
          const a = -Math.PI / 2 + (i * Math.PI) / 5;
          const r = i % 2 === 0 ? 10 : 4.2;
          return [12 + Math.cos(a) * r, 12 + Math.sin(a) * r] as Point;
        }),
        closed: true,
      },
    ],
  },
  spiral: {
    strokes: [
      {
        points: Array.from({ length: 23 }, (_, i) => {
          const a = i * 0.45;
          const r = 1.2 + a * 0.85;
          return [12 + Math.cos(a) * r, 12 + Math.sin(a) * r] as Point;
        }),
      },
    ],
  },
  circle: { strokes: [{ points: ring(12, 12, 8, 16), closed: true }] },
  zigzags: {
    strokes: [
      { points: [[3, 9], [7, 5], [11, 9], [15, 5], [19, 9]] },
      { points: [[5, 17], [9, 13], [13, 17], [17, 13], [21, 17]] },
    ],
  },
  dots: { strokes: [], dots: [[7, 16, 2.6], [12, 7, 2.6], [17.5, 15, 2.6]], filled: true },
} satisfies Record<string, Doodle>;

export const DOODLE_LIST: Doodle[] = Object.values(DOODLES);

// Hand-drawn trend arrows (Price Watch's fresh pick cards): down = cheaper,
// up = pricier, flat = stable. Kept out of DOODLES so they never show up as
// confetti.
export const TREND_DOODLES = {
  down: { strokes: [{ points: [[2, 6], [8, 11.5], [12, 8.5], [21, 17]] }, { points: [[14.5, 17.5], [21, 17], [20.5, 10.5]] }] },
  up: { strokes: [{ points: [[2, 18], [8, 12.5], [12, 15.5], [21, 7]] }, { points: [[14.5, 6.5], [21, 7], [20.5, 13.5]] }] },
  flat: { strokes: [{ points: [[2, 12], [7, 9.5], [12, 13], [16, 10.5], [21, 12]] }, { points: [[17.5, 8.5], [21, 12], [17.5, 15.5]] }] },
} satisfies Record<string, Doodle>;
// Confetti alternates between these, like the intro's green/orange.
export const DOODLE_COLORS = [colors.primary, colors.accent];

const jitter = (v: number) => v + (Math.random() - 0.5) * 2 * JITTER;

export type DoodleVersion = { d: string; dots: [number, number, number][]; filled: boolean };

// One hand-drawn take on a doodle: same shape, every point nudged a little.
// Two of these swapped every ~100ms gives the intro's "line boil".
export function drawDoodle(doodle: Doodle): DoodleVersion {
  const d = doodle.strokes
    .map(({ points, closed }) => {
      const [first, ...rest] = points.map(([x, y]) => `${jitter(x).toFixed(1)} ${jitter(y).toFixed(1)}`);
      return `M${first}${rest.map((p) => ` L${p}`).join("")}${closed ? " Z" : ""}`;
    })
    .join(" ");
  const dots = (doodle.dots ?? []).map(([x, y, r]) => [jitter(x), jitter(y), r] as [number, number, number]);
  return { d, dots, filled: !!doodle.filled };
}

// The two versions BoilingDoodle flips between.
export function drawBoilPair(doodle: Doodle): [DoodleVersion, DoodleVersion] {
  return [drawDoodle(doodle), drawDoodle(doodle)];
}

export function DoodleSvg({
  version,
  size,
  color,
  strokeWidth = STROKE_WIDTH,
}: {
  version: DoodleVersion;
  size: number;
  color: string;
  /** In viewBox units (24 = full width). */
  strokeWidth?: number;
}) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      {version.d ? (
        <Path
          d={version.d}
          stroke={color}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeLinejoin="round"
          fill={version.filled ? color : "none"}
        />
      ) : null}
      {version.dots.map(([cx, cy, r], i) => (
        <Circle key={i} cx={cx} cy={cy} r={r} fill={color} />
      ))}
    </Svg>
  );
}

// "Line boil" like the intro.gif: flips between two hand-drawn versions of
// the same doodle every BOIL_MS, on a loop, for as long as it's mounted.
const BOIL_MS = 100;

export function BoilingDoodle({
  versions,
  size,
  color,
  strokeWidth,
}: {
  versions: readonly [DoodleVersion, DoodleVersion];
  size: number;
  color: string;
  strokeWidth?: number;
}) {
  const boil = useSharedValue(0);

  useEffect(() => {
    boil.value = withRepeat(withTiming(2, { duration: 2 * BOIL_MS, easing: Easing.linear }), -1, false);
  }, [boil]);

  const firstStyle = useAnimatedStyle(() => ({ opacity: boil.value < 1 ? 1 : 0 }));
  const secondStyle = useAnimatedStyle(() => ({ opacity: boil.value < 1 ? 0 : 1 }));

  return (
    <View style={{ width: size, height: size }}>
      <Animated.View style={[{ position: "absolute" }, firstStyle]}>
        <DoodleSvg version={versions[0]} size={size} color={color} strokeWidth={strokeWidth} />
      </Animated.View>
      <Animated.View style={[{ position: "absolute" }, secondStyle]}>
        <DoodleSvg version={versions[1]} size={size} color={color} strokeWidth={strokeWidth} />
      </Animated.View>
    </View>
  );
}
