import { type RefObject, useEffect, useRef, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import Animated, {
  Easing,
  FadeInDown,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import { Bookmark, ChevronUp, Heart } from "lucide-react-native";
import { Confetti, PageIntro, type IntroSize } from "@/frontend/components/ui";
import { colors } from "@/frontend/constants/theme";

// A quick glance at Discover, on black like its reel:
//   0.0s   "Hungry for ideas?" rises in
//   0.5s   dish names swipe up one after another, like flicking the reel,
//          a chevron nudging up with each one
//   1.8s   it stops on one; a heart pops (with confetti), then a bookmark:
//          like it, save it
//   2.7s   that slides away; "Your turn." fades in
//   3.3s   "Share it." slams in, in orange; its period is the dot
//   4.0s   everything collapses into that dot, which arcs up to the Create
//          (+) button (see PageIntro) and laps it once (OrbitHighlight)
const SWIPE_AT = 500;
const SWIPE_MS = 260;
const SWIPE_GAP_MS = 60;
const LIKE_AT = 1800;
const SAVE_AT = 2100;
const OUT_AT = 2700;
const TURN_AT = 2850;
const SHARE_AT = 3300;
const COLLAPSE_AT = 4000;
const COLLAPSE_MS = 380;
const DOT_AT = COLLAPSE_AT + 60;
const FLY_AT = 4300;

// Swiped through top to bottom, stopping on the last.
const DISHES = ["Sinigang", "Sisig", "Kare-Kare", "Bulalo", "Adobo"];
const ROW_HEIGHT = 64;

// "Share it."'s period, drawn so it can be the dot. Sized for text-subhero.
const PERIOD = 10;
const PERIOD_BASELINE = 10;

const POP_SPRING = { damping: 8, stiffness: 220, mass: 0.5 };
const SLAM_SPRING = { damping: 11, stiffness: 320, mass: 0.6 };

type Point = { x: number; y: number };

const center = (size: IntroSize) => ({ x: size.w / 2, y: size.h / 2 });

function Pop({ at, children, className }: { at: number; children: React.ReactNode; className?: string }) {
  const pop = useSharedValue(0);
  useEffect(() => {
    pop.value = withDelay(at, withSpring(1, POP_SPRING));
  }, [pop, at]);
  const style = useAnimatedStyle(() => ({ opacity: Math.min(1, pop.value * 2), transform: [{ scale: pop.value }] }));
  return (
    <Animated.View style={style} className={className}>
      {children}
    </Animated.View>
  );
}

function ReelScene({ size, onPeriod }: { size: IntroSize; onPeriod: (p: Point) => void }) {
  const swipe = useSharedValue(0);
  const nudge = useSharedValue(0);
  const out = useSharedValue(0);
  const turn = useSharedValue(0);
  const slam = useSharedValue(0);
  const collapse = useSharedValue(0);
  const [likeBurst, setLikeBurst] = useState(0);
  const [period, setPeriod] = useState<Point | null>(null);
  // "Share it."'s row (in the scene) and its period (in the row), from
  // onLayout, which ignores the slam's scale.
  const rowAt = useRef<Point | null>(null);
  const periodAt = useRef<Point | null>(null);

  useEffect(() => {
    // One swipe per dish after the first, each settling before the next.
    swipe.value = withDelay(
      SWIPE_AT,
      withSequence(
        ...DISHES.slice(1).map((_, i) =>
          withDelay(i === 0 ? 0 : SWIPE_GAP_MS, withTiming(i + 1, { duration: SWIPE_MS, easing: Easing.out(Easing.cubic) })),
        ),
      ),
    );
    nudge.value = withDelay(
      SWIPE_AT,
      withRepeat(
        withSequence(withTiming(1, { duration: SWIPE_MS / 2 }), withTiming(0, { duration: SWIPE_MS / 2 + SWIPE_GAP_MS })),
        DISHES.length - 1,
      ),
    );
    out.value = withDelay(OUT_AT, withTiming(1, { duration: 300, easing: Easing.in(Easing.cubic) }));
    turn.value = withDelay(TURN_AT, withTiming(1, { duration: 400 }));
    slam.value = withDelay(SHARE_AT, withSpring(1, SLAM_SPRING));
    collapse.value = withDelay(COLLAPSE_AT, withTiming(1, { duration: COLLAPSE_MS, easing: Easing.in(Easing.cubic) }));
    const like = setTimeout(() => setLikeBurst(1), LIKE_AT);
    return () => clearTimeout(like);
  }, []);

  const placePeriod = () => {
    const row = rowAt.current;
    const dot = periodAt.current;
    if (!row || !dot) return;
    const point = { x: row.x + dot.x + PERIOD / 2, y: row.y + dot.y + PERIOD / 2 };
    setPeriod(point);
    onPeriod(point);
  };

  const reelStyle = useAnimatedStyle(() => ({ transform: [{ translateY: -ROW_HEIGHT * swipe.value }] }));
  const nudgeStyle = useAnimatedStyle(() => ({ opacity: 0.4 + 0.6 * nudge.value, transform: [{ translateY: -6 * nudge.value }] }));
  const outStyle = useAnimatedStyle(() => ({ opacity: 1 - out.value, transform: [{ translateY: -40 * out.value }] }));
  const turnStyle = useAnimatedStyle(() => ({ opacity: turn.value, transform: [{ translateY: 10 * (1 - turn.value) }] }));
  const slamStyle = useAnimatedStyle(() => ({
    opacity: Math.min(1, slam.value * 3),
    transform: [{ scale: 1.8 - 0.8 * slam.value }],
  }));
  // Everything shrinks into "Share it."'s period (where PageIntro's dot
  // takes over).
  const collapseStyle = useAnimatedStyle(() => ({ opacity: 1 - collapse.value, transform: [{ scale: 1 - 0.85 * collapse.value }] }));

  return (
    <Animated.View
      style={[StyleSheet.absoluteFill, { transformOrigin: period ? [period.x, period.y, 0] : "center" }, collapseStyle]}
    >
      {/* The reel part: swiping, then like + save. */}
      <Animated.View style={[{ marginTop: size.h * 0.16 }, outStyle]} className="items-center">
        <Animated.View entering={FadeInDown.duration(450)}>
          <Text className="font-inter-medium text-subheading text-white/70">Hungry for ideas?</Text>
        </Animated.View>

        <View className="mt-4 self-stretch overflow-hidden" style={{ height: ROW_HEIGHT }}>
          <Animated.View style={reelStyle}>
            {DISHES.map((dish, i) => (
              <Text
                key={dish}
                style={{ height: ROW_HEIGHT, lineHeight: ROW_HEIGHT }}
                className={`text-center font-inter-extrabold text-subhero tracking-display ${
                  i === DISHES.length - 1 ? "text-accent" : "text-white"
                }`}
              >
                {dish}
              </Text>
            ))}
          </Animated.View>
        </View>

        <Animated.View style={nudgeStyle} className="mt-1">
          <ChevronUp color={colors.white} size={22} />
        </Animated.View>

        <View className="mt-6 flex-row gap-4">
          <View>
            <Confetti burstId={likeBurst} direction="up" />
            <Pop at={LIKE_AT} className="h-11 w-11 items-center justify-center rounded-full border border-like bg-like">
              <Heart color={colors.white} fill={colors.white} size={20} />
            </Pop>
          </View>
          <Pop at={SAVE_AT} className="h-11 w-11 items-center justify-center rounded-full border border-brand-green bg-brand-green">
            <Bookmark color={colors.white} fill={colors.white} size={20} />
          </Pop>
        </View>
      </Animated.View>

      {/* Then the ask. */}
      <View style={StyleSheet.absoluteFill} className="items-center justify-center">
        <Animated.View style={turnStyle}>
          <Text className="font-inter-extrabold text-heading-lg tracking-display text-white">
            Your turn<Text className="text-accent">.</Text>
          </Text>
        </Animated.View>
        <View
          className="mt-1"
          onLayout={(e) => {
            rowAt.current = { x: e.nativeEvent.layout.x, y: e.nativeEvent.layout.y };
            placePeriod();
          }}
        >
          <Animated.View style={slamStyle} className="flex-row items-end">
            <Text className="font-inter-extrabold text-subhero tracking-display text-accent">Share it</Text>
            <View
              className="ml-1 rounded-full bg-accent"
              style={{ width: PERIOD, height: PERIOD, marginBottom: PERIOD_BASELINE }}
              onLayout={(e) => {
                periodAt.current = { x: e.nativeEvent.layout.x, y: e.nativeEvent.layout.y };
                placePeriod();
              }}
            />
          </Animated.View>
        </View>
      </View>
    </Animated.View>
  );
}

type DiscoverIntroProps = {
  active: boolean;
  /** The Create button's landing spot (see CreateButton's landingRef). */
  targetRef: RefObject<View | null>;
  onDone: () => void;
};

export function DiscoverIntro({ active, targetRef, onDone }: DiscoverIntroProps) {
  const period = useRef<Point | null>(null);
  return (
    <PageIntro
      active={active}
      targetRef={targetRef}
      onDone={onDone}
      // Takes off from "Share it."'s period, once the scene has collapsed
      // into it.
      dotStart={(size) => period.current ?? center(size)}
      dotAt={DOT_AT}
      flyAt={FLY_AT}
      dotSize={PERIOD}
      tone="dark"
      accessibilityLabel="Discover: swipe up through meals, like and save the ones you want, and share your own with the Create button."
    >
      {(size) => (
        <ReelScene
          size={size}
          onPeriod={(p) => {
            period.current = p;
          }}
        />
      )}
    </PageIntro>
  );
}
