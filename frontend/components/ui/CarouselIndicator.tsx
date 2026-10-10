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

// "hop" variant sizes: faint 8px dots 8px apart, and a slightly bigger
// accent dot riding on top of the active one.
const HOP_DOT = 8;
const HOP_STEP = HOP_DOT + 8;
const HOP_ACTIVE = 10;
const HOP_MS = 320;
// Arc height for a one-page hop; longer jumps arc a little higher.
const HOP_ARC = 10;

// The showreel's dot: one accent dot that jumps between the faint dots in an
// arc, stretching mid-air and squashing when it lands.
function HopIndicator({ total, activeIndex }: { total: number; activeIndex: number }) {
  const from = useSharedValue(activeIndex * HOP_STEP);
  const to = useSharedValue(activeIndex * HOP_STEP);
  const arc = useSharedValue(HOP_ARC);
  // 0 -> 1 over a hop (already eased); 1 when resting.
  const hop = useSharedValue(1);
  // Landing squash: 1 at impact, springs back through 0.
  const squash = useSharedValue(0);
  const mounted = useRef(false);

  useEffect(() => {
    if (!mounted.current) {
      mounted.current = true;
      return;
    }
    // Take off from wherever the dot is now, so quick taps chain smoothly.
    const here = from.value + (to.value - from.value) * hop.value;
    from.value = here;
    to.value = activeIndex * HOP_STEP;
    arc.value = HOP_ARC + 4 * Math.max(0, Math.abs(to.value - here) / HOP_STEP - 1);
    hop.value = 0;
    hop.value = withTiming(1, { duration: HOP_MS, easing: Easing.inOut(Easing.quad) });
    squash.value = withDelay(
      HOP_MS,
      withSequence(withTiming(1, { duration: 70 }), withSpring(0, { damping: 6, stiffness: 260, mass: 0.5 })),
    );
  }, [activeIndex, from, to, arc, hop, squash]);

  const dotStyle = useAnimatedStyle(() => {
    const h = hop.value;
    const stretch = Math.sin(Math.PI * h) * 0.35;
    const q = squash.value * 0.3;
    return {
      transform: [
        { translateX: from.value + (to.value - from.value) * h },
        { translateY: -arc.value * 4 * h * (1 - h) },
        { scaleX: (1 + stretch) * (1 + q) },
        { scaleY: (1 - stretch * 0.5) * (1 - q) },
      ],
    };
  });

  // Every dot is placed at i * HOP_STEP (not flex gap), so the accent dot,
  // which moves by the same step, always lands dead center on a faint one.
  const inset = (HOP_ACTIVE - HOP_DOT) / 2;
  return (
    <View
      accessible
      accessibilityLabel={`Page ${activeIndex + 1} of ${total}`}
      style={{ width: (total - 1) * HOP_STEP + HOP_ACTIVE, height: HOP_ACTIVE }}
    >
      {Array.from({ length: total }).map((_, i) => (
        <View
          key={i}
          className="absolute h-2 w-2 rounded-full bg-primary/20"
          style={{ left: i * HOP_STEP + inset, top: inset }}
        />
      ))}
      <Animated.View
        style={[
          {
            position: "absolute",
            left: 0,
            top: 0,
            width: HOP_ACTIVE,
            height: HOP_ACTIVE,
            borderRadius: HOP_ACTIVE / 2,
            backgroundColor: colors.accent,
          },
          dotStyle,
        ]}
      />
    </View>
  );
}

type Props = {
  total: number;
  activeIndex: number;
  /** "pill" (default): the active dot widens into a green pill. "hop": an
   *  accent dot jumps between the dots (Price Watch's fresh picks). */
  variant?: "pill" | "hop";
};

export function CarouselIndicator({ total, activeIndex, variant = "pill" }: Props) {
  if (variant === "hop") return <HopIndicator total={total} activeIndex={activeIndex} />;
  return (
    <View className="flex-row gap-2">
      {Array.from({ length: total }).map((_, i) => (
        <Dot key={i} isActive={i === activeIndex} />
      ))}
    </View>
  );
}
