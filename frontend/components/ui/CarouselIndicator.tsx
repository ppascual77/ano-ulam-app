import { useEffect, useRef } from "react";
import { View } from "react-native";
import Animated, {
  Easing,
  useSharedValue,
  useAnimatedStyle,
  withDelay,
  withSequence,
  withSpring,
  withTiming,
  interpolate,
  interpolateColor,
} from "react-native-reanimated";
import { colors } from "@/frontend/constants/theme";

// Same color as bg-primary/20 — interpolateColor needs a literal color
// value, not a Tailwind opacity modifier.
const INACTIVE_COLOR = "rgba(40, 96, 70, 0.2)";

function Dot({ isActive }: { isActive: boolean }) {
  const progress = useSharedValue(isActive ? 1 : 0);

  useEffect(() => {
    progress.value = withTiming(isActive ? 1 : 0, { duration: 250 });
  }, [isActive, progress]);

  const style = useAnimatedStyle(() => ({
    width: interpolate(progress.value, [0, 1], [8, 24]),
    backgroundColor: interpolateColor(progress.value, [0, 1], [INACTIVE_COLOR, colors.primary]),
  }));

  return <Animated.View style={[{ height: 8, borderRadius: 999 }, style]} />;
}

// "hop" variant: faint 8px dots, and one accent marker that hops between
// them. At rest the marker is a slightly bigger ball ("dot") or a flat pill
// ("pill"); a pill squeezes into a ball before it hops and flattens out
// again when it lands.
const HOP_DOT = 8;
const HOP_BALL = 10;
const HOP_PILL = 24;
// Distance between dot centers: wider for a pill, so it never touches the
// dots next to it.
const HOP_STEP = { dot: HOP_DOT + 8, pill: HOP_PILL + 4 } as const;
const HOP_MS = 320;
// Pill only: squeezing into a ball before the hop.
const SQUEEZE_MS = 120;
const FLATTEN_SPRING = { damping: 11, stiffness: 240, mass: 0.6 };
// Arc height for a one-page hop; longer jumps arc a little higher.
const HOP_ARC = 10;

export type HopRest = keyof typeof HOP_STEP;

// The showreel's dot: one accent marker that jumps between the faint dots in
// an arc, stretching mid-air and squashing when it lands.
function HopIndicator({
  total,
  activeIndex,
  rest,
  color,
}: {
  total: number;
  activeIndex: number;
  rest: HopRest;
  color: string;
}) {
  const step = HOP_STEP[rest];
  const restWidth = rest === "pill" ? HOP_PILL : HOP_BALL;
  // Everything is laid out around dot centers; this inset keeps the widest
  // marker inside the container.
  const inset = Math.max(HOP_PILL * (rest === "pill" ? 1 : 0), HOP_BALL) / 2;
  const centerOf = (i: number) => inset + i * step;

  const from = useSharedValue(centerOf(activeIndex));
  const to = useSharedValue(centerOf(activeIndex));
  const arc = useSharedValue(HOP_ARC);
  // 0 -> 1 over a hop (already eased); 1 when resting.
  const hop = useSharedValue(1);
  // Landing squash: 1 at impact, springs back through 0.
  const squash = useSharedValue(0);
  // The marker's width: restWidth at rest, HOP_BALL while hopping.
  const width = useSharedValue(restWidth);
  const mounted = useRef(false);

  useEffect(() => {
    if (!mounted.current) {
      mounted.current = true;
      return;
    }
    // Take off from wherever the marker is now, so quick taps chain smoothly.
    const here = from.value + (to.value - from.value) * hop.value;
    from.value = here;
    to.value = centerOf(activeIndex);
    arc.value = HOP_ARC + 4 * Math.max(0, Math.abs(to.value - here) / step - 1);
    const squeeze = rest === "pill" ? SQUEEZE_MS : 0;
    // Pill: squeeze into a ball, hop, then flatten out on landing.
    if (rest === "pill") {
      width.value = withSequence(
        withTiming(HOP_BALL, { duration: SQUEEZE_MS, easing: Easing.in(Easing.quad) }),
        withDelay(HOP_MS, withSpring(HOP_PILL, FLATTEN_SPRING)),
      );
    }
    hop.value = 0;
    hop.value = withDelay(squeeze, withTiming(1, { duration: HOP_MS, easing: Easing.inOut(Easing.quad) }));
    squash.value = withDelay(
      squeeze + HOP_MS,
      withSequence(withTiming(1, { duration: 70 }), withSpring(0, { damping: 6, stiffness: 260, mass: 0.5 })),
    );
  }, [activeIndex]);

  const markerStyle = useAnimatedStyle(() => {
    const h = hop.value;
    const w = width.value;
    // A ball is HOP_BALL tall; flattening into the pill thins it to a dot's height.
    const height = HOP_BALL - ((w - HOP_BALL) / Math.max(HOP_PILL - HOP_BALL, 1)) * (HOP_BALL - HOP_DOT);
    const stretch = Math.sin(Math.PI * h) * 0.35;
    const q = squash.value * 0.3;
    return {
      width: w,
      height,
      borderRadius: height / 2,
      transform: [
        { translateX: from.value + (to.value - from.value) * h - w / 2 },
        { translateY: (HOP_BALL - height) / 2 - arc.value * 4 * h * (1 - h) },
        { scaleX: (1 + stretch) * (1 + q) },
        { scaleY: (1 - stretch * 0.5) * (1 - q) },
      ],
    };
  });

  // Every dot is placed at its center (not flex gap), so the marker, which
  // moves between the same centers, always lands dead on one.
  return (
    <View
      accessible
      accessibilityLabel={`Page ${activeIndex + 1} of ${total}`}
      style={{ width: centerOf(total - 1) + inset, height: HOP_BALL }}
    >
      {Array.from({ length: total }).map((_, i) => (
        <View
          key={i}
          className="absolute h-2 w-2 rounded-full bg-primary/20"
          style={{ left: centerOf(i) - HOP_DOT / 2, top: (HOP_BALL - HOP_DOT) / 2 }}
        />
      ))}
      <Animated.View style={[{ position: "absolute", left: 0, top: 0, backgroundColor: color }, markerStyle]} />
    </View>
  );
}

type Props = {
  total: number;
  activeIndex: number;
  /** "pill" (default): the active dot widens into a green pill. "hop": an
   *  accent marker hops between the dots (Price Watch's fresh picks,
   *  Onboarding). */
  variant?: "pill" | "hop";
  /** "hop" only. The marker at rest: "dot" (default) a ball, "pill" a flat
   *  pill that squeezes into a ball to hop and flattens out on landing. */
  hopRest?: HopRest;
  /** "hop" only. The marker's color. Defaults to the accent. */
  hopColor?: string;
};

export function CarouselIndicator({ total, activeIndex, variant = "pill", hopRest = "dot", hopColor = colors.accent }: Props) {
  if (variant === "hop") return <HopIndicator total={total} activeIndex={activeIndex} rest={hopRest} color={hopColor} />;
  return (
    <View className="flex-row gap-2">
      {Array.from({ length: total }).map((_, i) => (
        <Dot key={i} isActive={i === activeIndex} />
      ))}
    </View>
  );
}
