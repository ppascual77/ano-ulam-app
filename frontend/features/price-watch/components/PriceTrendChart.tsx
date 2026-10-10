import { useEffect, useMemo, useState } from "react";
import Animated, { Easing, useAnimatedProps, useSharedValue, withDelay, withSpring, withTiming } from "react-native-reanimated";
import { Pressable, Text, View } from "react-native";
import Svg, { Circle, Line, Path, Text as SvgText } from "react-native-svg";
import { colors, fonts } from "@/frontend/constants/theme";
import {
  addDays,
  formatPeso,
  formatShortDate,
  parseLocalDate,
  toIsoDate,
  type DailyPoint,
} from "@/frontend/core/prices/utils/prices";

const HEIGHT = 160;
const Y_LABEL_WIDTH = 44;
const X_LABEL_HEIGHT = 18;
const RIGHT_PAD = 8;
const TOP_PAD = 8;
// Narrowest gap between two day labels ("28" at 10pt plus breathing room).
const MIN_LABEL_SPACING = 22;
const RANGE_DAYS = 30;
// SVG text can't take a className: the "sub" font size (tailwind.config.js).
const LABEL_SIZE = 10;
// Opening animation: the line draws itself left to right, then the latest
// price lands as the accent dot with a ring rippling off it.
const LINE_MS = 1000;
const RING_MS = 650;
const DOT_RADIUS = 4.5;
const RING_GROWTH = 10;
const DOT_SPRING = { damping: 7, stiffness: 240, mass: 0.5 };

const AnimatedPath = Animated.createAnimatedComponent(Path);
const AnimatedCircle = Animated.createAnimatedComponent(Circle);

function DrawnLine({ d, length, endX, endY, delay }: { d: string; length: number; endX: number; endY: number; delay: number }) {
  const draw = useSharedValue(0);
  const dot = useSharedValue(0);
  const ring = useSharedValue(0);

  useEffect(() => {
    draw.value = 0;
    dot.value = 0;
    ring.value = 0;
    draw.value = withDelay(delay, withTiming(1, { duration: LINE_MS, easing: Easing.inOut(Easing.cubic) }));
    dot.value = withDelay(delay + LINE_MS, withSpring(1, DOT_SPRING));
    ring.value = withDelay(delay + LINE_MS, withTiming(1, { duration: RING_MS, easing: Easing.out(Easing.cubic) }));
  }, [d, delay, draw, dot, ring]);

  const lineProps = useAnimatedProps(() => ({ strokeDashoffset: length * (1 - draw.value) }));
  const dotProps = useAnimatedProps(() => ({ r: DOT_RADIUS * dot.value }));
  const ringProps = useAnimatedProps(() => ({
    r: DOT_RADIUS + RING_GROWTH * ring.value,
    strokeOpacity: ring.value === 0 ? 0 : 0.5 * (1 - ring.value),
  }));

  return (
    <>
      <AnimatedPath
        d={d}
        stroke={colors.primary}
        strokeWidth={2.5}
        fill="none"
        strokeLinejoin="round"
        strokeLinecap="round"
        strokeDasharray={[length, length]}
        animatedProps={lineProps}
      />
      <AnimatedCircle cx={endX} cy={endY} fill="none" stroke={colors.accent} strokeWidth={2} animatedProps={ringProps} />
      <AnimatedCircle cx={endX} cy={endY} fill={colors.accent} animatedProps={dotProps} />
    </>
  );
}

// Padded Y domain so a flat or tiny-range line doesn't sit on an edge.
function yDomain(values: number[]): [number, number] {
  const min = Math.min(...values);
  const max = Math.max(...values);
  const mid = (min + max) / 2;
  const pad = Math.max((max - min) * 0.2, mid * 0.03);
  return [Math.floor(min - pad), Math.ceil(max + pad)];
}

// Every day while they fit, else every 2nd/3rd/... day, always ending on
// the latest. Labels are short ("4"), with the month only where it starts
// or changes ("Oct 3", "Nov 1"), so a day each still fits.
function pickLabelIndexes(points: DailyPoint[], plotWidth: number): number[] {
  const step = Math.max(1, Math.ceil((points.length * MIN_LABEL_SPACING) / plotWidth));
  const picked: number[] = [];
  for (let i = points.length - 1; i >= 0; i -= step) picked.unshift(i);
  return picked;
}

function dayLabel(points: DailyPoint[], labelIndexes: number[], i: number): string {
  const position = labelIndexes.indexOf(i);
  const prev = position > 0 ? points[labelIndexes[position - 1]] : null;
  const date = parseLocalDate(points[i].date);
  return !prev || parseLocalDate(prev.date).getMonth() !== date.getMonth()
    ? formatShortDate(points[i].date)
    : String(date.getDate());
}

// Daily DA prices over the last 30 days. One point per DA publish day, x
// spaced by date (a 3-day gap looks wider than a 1-day step), straight
// lines between real points, nothing filled in for missing days.
type PriceTrendChartProps = {
  daily: DailyPoint[];
  /** Before the line starts drawing, in ms (e.g. to follow a sheet's other
   *  entrance animations). */
  drawDelay?: number;
};

export function PriceTrendChart({ daily, drawDelay = 0 }: PriceTrendChartProps) {
  const [width, setWidth] = useState(0);
  const [selected, setSelected] = useState<number | null>(null);

  const points = useMemo(() => {
    const since = addDays(toIsoDate(new Date()), -RANGE_DAYS);
    return daily.filter((d) => d.date >= since);
  }, [daily]);

  if (points.length < 2) {
    return (
      <Text className="py-6 text-center font-inter-regular text-small text-ink-subtle">
        Not enough data for this period.
      </Text>
    );
  }

  const [yMin, yMax] = yDomain(points.map((p) => p.price));
  const t0 = parseLocalDate(points[0].date).getTime();
  const t1 = parseLocalDate(points.at(-1)!.date).getTime();
  const plotLeft = Y_LABEL_WIDTH;
  const plotWidth = Math.max(width - plotLeft - RIGHT_PAD, 1);
  const plotBottom = HEIGHT - X_LABEL_HEIGHT;
  const plotHeight = plotBottom - TOP_PAD;
  const x = (date: string) => plotLeft + ((parseLocalDate(date).getTime() - t0) / Math.max(t1 - t0, 1)) * plotWidth;
  const y = (price: number) => TOP_PAD + (1 - (price - yMin) / Math.max(yMax - yMin, 1)) * plotHeight;

  const path = points.map((p, i) => `${i === 0 ? "M" : "L"}${x(p.date)},${y(p.price)}`).join(" ");
  // Straight segments, so the exact length is just their sum (for the draw-in).
  const pathLength = points.reduce(
    (sum, p, i) => (i === 0 ? 0 : sum + Math.hypot(x(p.date) - x(points[i - 1].date), y(p.price) - y(points[i - 1].price))),
    0,
  );
  const yTicks = [0, 1, 2, 3].map((i) => yMin + ((yMax - yMin) * i) / 3);
  const labelIndexes = pickLabelIndexes(points, plotWidth);
  const last = points.at(-1)!;
  const active = selected != null ? points[selected] : null;

  const first = points[0];
  const summary = `Daily price over the last 30 days: from ${formatPeso(first.price)} on ${formatShortDate(first.date)} to ${formatPeso(last.price)} on ${formatShortDate(last.date)}`;

  // Tap anywhere on the chart to read the nearest day.
  const handlePress = (locationX: number) => {
    let nearest = 0;
    points.forEach((p, i) => {
      if (Math.abs(x(p.date) - locationX) < Math.abs(x(points[nearest].date) - locationX)) nearest = i;
    });
    setSelected(nearest === selected ? null : nearest);
  };

  return (
    <View accessible accessibilityLabel={summary}>
      <Text className="mb-1 h-5 font-inter-medium text-small text-ink-emphasis">
        {active ? `${formatShortDate(active.date)} · ${formatPeso(active.price)}` : " "}
      </Text>
      <Pressable onLayout={(e) => setWidth(e.nativeEvent.layout.width)} onPress={(e) => handlePress(e.nativeEvent.locationX)}>
        {width > 0 && (
          <Svg width={width} height={HEIGHT}>
            {yTicks.map((v) => (
              <Line
                key={`g${v}`}
                x1={plotLeft}
                x2={plotLeft + plotWidth}
                y1={y(v)}
                y2={y(v)}
                stroke={colors.webDivider}
                strokeDasharray="3 3"
              />
            ))}
            {yTicks.map((v) => (
              <SvgText
                key={`y${v}`}
                x={plotLeft - 6}
                y={y(v) + 3}
                fontSize={LABEL_SIZE}
                fontFamily={fonts.regular}
                fill={colors.webInk.muted}
                textAnchor="end"
              >
                {`₱${Math.round(v)}`}
              </SvgText>
            ))}
            {labelIndexes.map((i) => (
              <SvgText
                key={`x${i}`}
                x={x(points[i].date)}
                y={HEIGHT - 4}
                fontSize={LABEL_SIZE}
                fontFamily={fonts.regular}
                fill={colors.webInk.muted}
                textAnchor={i === 0 ? "start" : i === points.length - 1 && dayLabel(points, labelIndexes, i).length > 2 ? "end" : "middle"}
              >
                {dayLabel(points, labelIndexes, i)}
              </SvgText>
            ))}
            <DrawnLine d={path} length={pathLength} endX={x(last.date)} endY={y(last.price)} delay={drawDelay} />
            {active && (
              <>
                <Line
                  x1={x(active.date)}
                  x2={x(active.date)}
                  y1={TOP_PAD}
                  y2={plotBottom}
                  stroke={colors.webInk.faint}
                />
                <Circle cx={x(active.date)} cy={y(active.price)} r={4} fill={colors.white} stroke={colors.primary} strokeWidth={2} />
              </>
            )}
          </Svg>
        )}
      </Pressable>
    </View>
  );
}
