import { type RefObject, useEffect, useMemo } from "react";
import { Text, View } from "react-native";
import Animated, {
  Easing,
  FadeInDown,
  type SharedValue,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import { PageIntro, type IntroSize } from "@/frontend/components/ui";
import { colors } from "@/frontend/constants/theme";
import { useCountTo } from "@/frontend/core/prices/hooks/useCountTo";
import { NCR_MARKETS } from "../constants/markets";

// A quick glance at what Price Watch is, the showreel's DA scene:
//   0.0s   "Straight from the DA." rises in
//   0.35s  one dot per NCR market pops in as a cloud, counting up
//   1.5s   the dots converge and merge into one accent dot
//   1.95s  "one daily average" (handwritten) pops under it
//   2.55s  the cover fades to the real page as the dot arcs up and lands as
//          the period of the "Price Watch." header (see PageIntro)
const DOTS_AT = 350;
const DOT_STAGGER_MS = 22;
const MERGE_AT = 1500;
const MERGE_MS = 450;
const NOTE_AT = MERGE_AT + MERGE_MS;
const FLY_AT = 2550;

const MARKET_DOT = 10;
const MERGED_DOT = 22;
const POP_SPRING = { damping: 8, stiffness: 220, mass: 0.5 };

type Point = { x: number; y: number };

const cloudCenter = (size: IntroSize): Point => ({ x: size.w / 2, y: size.h * 0.58 });

// Seeded, so the cloud looks the same every time (scaled to the screen).
function seededRandom(seed: number) {
  let s = seed;
  return () => {
    s = (s * 16807) % 2147483647;
    return s / 2147483647;
  };
}

// One point per market in an ellipse, kept apart so dots don't overlap.
function cloudPoints(count: number, c: Point, rx: number, ry: number): Point[] {
  const rand = seededRandom(20261010);
  const pts: Point[] = [];
  const minGap = Math.min(rx, ry) * 0.24;
  for (let tries = 0; pts.length < count && tries < 6000; tries++) {
    const a = rand() * Math.PI * 2;
    const r = Math.sqrt(rand());
    const p = { x: c.x + Math.cos(a) * r * rx, y: c.y + Math.sin(a) * r * ry };
    if (pts.every((q) => Math.hypot(q.x - p.x, q.y - p.y) > minGap)) pts.push(p);
  }
  return pts;
}

function MarketDot({ point, index, center, merge }: { point: Point; index: number; center: Point; merge: SharedValue<number> }) {
  const pop = useSharedValue(0);
  useEffect(() => {
    pop.value = withDelay(DOTS_AT + index * DOT_STAGGER_MS, withSpring(1, POP_SPRING));
  }, [pop, index]);

  const style = useAnimatedStyle(() => {
    const m = merge.value;
    return {
      opacity: m >= 0.98 ? 0 : 1,
      transform: [
        { translateX: (center.x - point.x) * m },
        { translateY: (center.y - point.y) * m },
        { scale: pop.value * (1 - 0.5 * m) },
      ],
    };
  });

  return (
    <Animated.View
      style={[
        {
          position: "absolute",
          left: point.x - MARKET_DOT / 2,
          top: point.y - MARKET_DOT / 2,
          width: MARKET_DOT,
          height: MARKET_DOT,
          borderRadius: MARKET_DOT / 2,
          // Every 5th in accent, like the showreel.
          backgroundColor: index % 5 === 0 ? colors.accent : colors.primary,
        },
        style,
      ]}
    />
  );
}

// The scene itself: mounted by PageIntro when the intro starts playing.
function DaScene({ size }: { size: IntroSize }) {
  const center = useMemo(() => cloudCenter(size), [size]);
  const points = useMemo(() => cloudPoints(NCR_MARKETS.length, center, size.w * 0.38, size.h * 0.13), [size, center]);
  const count = useCountTo(0, NCR_MARKETS.length, DOTS_AT, NCR_MARKETS.length * DOT_STAGGER_MS + 200);

  const merge = useSharedValue(0);
  const note = useSharedValue(0);
  useEffect(() => {
    merge.value = withDelay(MERGE_AT, withTiming(1, { duration: MERGE_MS, easing: Easing.in(Easing.cubic) }));
    note.value = withDelay(NOTE_AT, withSpring(1, POP_SPRING));
  }, [merge, note]);
  const noteStyle = useAnimatedStyle(() => ({ opacity: note.value, transform: [{ scale: 0.6 + 0.4 * note.value }, { rotate: "-4deg" }] }));

  return (
    <>
      <Animated.View entering={FadeInDown.duration(500)} className="items-center" style={{ marginTop: size.h * 0.12 }}>
        <Text className="font-inter-medium text-subheading text-ink-subtle">Straight from</Text>
        <Text className="font-inter-extrabold text-subhero tracking-display text-primary">
          the DA<Text className="text-accent">.</Text>
        </Text>
      </Animated.View>

      <Animated.View entering={FadeInDown.delay(250).duration(450)} className="mt-3 flex-row items-baseline justify-center gap-2">
        <Text className="font-inter-extrabold text-heading-lg text-primary">{Math.round(count)}</Text>
        <Text className="font-inter-bold text-subheading text-ink-emphasis">NCR markets</Text>
      </Animated.View>

      {points.map((p, i) => (
        <MarketDot key={i} point={p} index={i} center={center} merge={merge} />
      ))}

      <Animated.View className="absolute left-0 right-0 items-center" style={[{ top: center.y + MERGED_DOT + 8 }, noteStyle]}>
        <Text className="font-handwritten text-heading-lg text-accent">one daily average</Text>
      </Animated.View>
    </>
  );
}

type PriceWatchIntroProps = {
  active: boolean;
  targetRef: RefObject<View | null>;
  onDone: () => void;
};

export function PriceWatchIntro({ active, targetRef, onDone }: PriceWatchIntroProps) {
  return (
    <PageIntro
      active={active}
      targetRef={targetRef}
      onDone={onDone}
      dotStart={cloudCenter}
      dotAt={NOTE_AT - 60}
      flyAt={FLY_AT}
      dotSize={MERGED_DOT}
      accessibilityLabel="Price Watch: prices straight from the DA, a daily average of 35 NCR markets."
    >
      {(size) => <DaScene size={size} />}
    </PageIntro>
  );
}
