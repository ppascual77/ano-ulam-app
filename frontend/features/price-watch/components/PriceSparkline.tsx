import { useEffect, useMemo } from "react";
import Animated, { Easing, useAnimatedProps, useSharedValue, withDelay, withTiming } from "react-native-reanimated";
import Svg, { Circle, Path } from "react-native-svg";
import { colors } from "@/frontend/constants/theme";
import { useReduceMotion } from "@/frontend/core/preferences/store/useReduceMotionStore";
import { addDays, trendOf, type PriceItem } from "@/frontend/core/prices/utils/prices";

const AnimatedPath = Animated.createAnimatedComponent(Path);
const AnimatedCircle = Animated.createAnimatedComponent(Circle);
const W = 44;
const H = 28;
const PAD = 3;
const DRAW_MS = 520;

// The points of the last 7 days (plus the price before them, so a week with
// one new price still draws a line). Flat when there's only one price.
function weekPoints(item: PriceItem): number[] {
  const latest = item.daily.at(-1);
  if (!latest) return [];
  const cutoff = addDays(latest.date, -7);
  const start = Math.max(0, item.daily.findIndex((p) => p.date >= cutoff) - 1);
  const prices = item.daily.slice(start).map((p) => p.price);
  return prices.length > 1 ? prices : [prices[0], prices[0]];
}

// A price row's tiny week chart: the line in its trend color, drawn in from
// the left when it appears (`delay` staggers a list), ending in a dot on
// today's price. Instant with Reduce motion.
export function PriceSparkline({ item, delay = 0 }: { item: PriceItem; delay?: number }) {
  const reduce = useReduceMotion();
  const { d, length, end } = useMemo(() => {
    const pts = weekPoints(item);
    const lo = Math.min(...pts);
    const span = Math.max(...pts) - lo || 1;
    const xy = pts.map((p, i) => [PAD + (i * (W - PAD * 2)) / (pts.length - 1), H - PAD - ((p - lo) / span) * (H - PAD * 2)] as const);
    // A flat week sits in the middle instead of on the floor.
    const flat = pts.every((p) => p === pts[0]);
    const line = flat ? xy.map(([x]) => [x, H / 2] as const) : xy;
    let len = 0;
    for (let i = 1; i < line.length; i++) len += Math.hypot(line[i][0] - line[i - 1][0], line[i][1] - line[i - 1][1]);
    return {
      d: line.map(([x, y], i) => `${i ? "L" : "M"}${x.toFixed(1)} ${y.toFixed(1)}`).join(" "),
      length: Math.ceil(len) + 1,
      end: line.at(-1)!,
    };
  }, [item]);

  const drawn = useSharedValue(reduce ? 1 : 0);
  useEffect(() => {
    if (reduce) {
      drawn.value = 1;
      return;
    }
    drawn.value = 0;
    drawn.value = withDelay(delay, withTiming(1, { duration: DRAW_MS, easing: Easing.out(Easing.cubic) }));
  }, [item, delay, reduce, drawn]);
  const lineProps = useAnimatedProps(() => ({ strokeDashoffset: length * (1 - drawn.value) }));
  const dotProps = useAnimatedProps(() => ({ opacity: drawn.value > 0.95 ? 1 : 0 }));
  const color = colors.trend[trendOf(item.pctChange)];

  return (
    <Svg width={W} height={H} viewBox={`0 0 ${W} ${H}`}>
      <AnimatedPath
        d={d}
        stroke={color}
        strokeWidth={2.2}
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
        strokeDasharray={length}
        animatedProps={lineProps}
      />
      <AnimatedCircle cx={end[0]} cy={end[1]} r={2.8} fill={color} animatedProps={dotProps} />
    </Svg>
  );
}
