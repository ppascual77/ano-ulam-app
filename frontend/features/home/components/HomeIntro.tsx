import { type RefObject, useEffect, useRef, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import * as Haptics from "expo-haptics";
import Animated, {
  Easing,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSequence,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import { HOP_MARKER_SIZE, PageIntro, type IntroSize } from "@/frontend/components/ui";
import { colors } from "@/frontend/constants/theme";

// The welcome right after onboarding. Onboarding's page indicator dot comes
// along (see OnboardingScreen) and the whole thing plays out in words:
//   0.0s   the indicator's pill squeezes into a ball and hops up to become
//          the dot of "Hey, welcome!"'s "!"
//   0.5s   it lands and the greeting waves (tilts back and forth twice)
//   0.9s   "Ano ulam mo today?" slams in
//   1.8s   a reel of dishes spins and stops on "Ask AnoUlam."
//   3.0s   "We'll figure it out together." fades in
//   3.6s   "Tara, kain!" (handwritten) pops in
//   4.2s   everything collapses into the "!"'s dot, which then arcs up and
//          lands as the period of "Categories." (see PageIntro), where
//          HomeScreen bursts confetti
const ENTRY_MS = 500;
const ENTRY_ARC = 140;
const WAVE_STEP_MS = 110;
const SLAM_AT = 900;
const SPIN_AT = 1800;
const SPIN_MS = 1200;
const TOGETHER_AT = 3000;
const NOTE_AT = 3600;
const COLLAPSE_AT = 4200;
const COLLAPSE_MS = 380;
const DOT_AT = COLLAPSE_AT + 60;
const FLY_AT = 4500;

// The "!" is drawn (stem + dot) instead of typed, so its dot can be the one
// that flies in. Sized for text-subhero (55px extrabold).
const BANG_STEM_W = 9;
const BANG_STEM_H = 27;
const BANG_GAP = 5;
const BANG_DOT = 10;
// Lifts the "!" onto the text's baseline.
const BANG_BASELINE = 10;

// Spins through these, landing on "Ask AnoUlam." (the last row).
const DISHES = ["Adobo", "Sinigang", "Sisig", "Kare-Kare", "Tinola", "Bulalo", "Laing", "Pancit"];
const REEL_LENGTH = DISHES.length + 1;
const ROW_HEIGHT = 44;
// The reel reads 20% bigger than the question above it. Scaled rather than
// a bigger font, since there's no type token at that size.
const REEL_SCALE = 1.2;
// Room for the scaled-up reel, which layout doesn't know about.
const REEL_GROWTH = (ROW_HEIGHT * (REEL_SCALE - 1)) / 2;

const POP_SPRING = { damping: 8, stiffness: 220, mass: 0.5 };
const SLAM_SPRING = { damping: 11, stiffness: 320, mass: 0.6 };
const ENTRY_SIZE = HOP_MARKER_SIZE.pill;

type Point = { x: number; y: number };

const center = (size: IntroSize) => ({ x: size.w / 2, y: size.h / 2 });

function WelcomeScene({ size, entry, onBang }: { size: IntroSize; entry?: Point; onBang: (p: Point) => void }) {
  const sceneRef = useRef<View>(null);
  const bangDotRef = useRef<View>(null);
  // Where the "!"'s dot sits (scene coordinates); the collapse shrinks
  // everything into it.
  const [bang, setBang] = useState<Point | null>(null);
  // The entry hop's ends, once measured (0,0 until then: kept hidden).
  const hopFrom = useSharedValue<Point | null>(null);
  const hopTo = useSharedValue<Point>({ x: 0, y: 0 });
  const mountedAt = useRef(Date.now());

  const greet = useSharedValue(0);
  const fly = useSharedValue(0);
  const land = useSharedValue(0);
  const wave = useSharedValue(0);
  const slam = useSharedValue(0);
  const spin = useSharedValue(0);
  const together = useSharedValue(0);
  const note = useSharedValue(0);
  const collapse = useSharedValue(0);

  useEffect(() => {
    greet.value = withDelay(100, withTiming(1, { duration: 350 }));
    slam.value = withDelay(SLAM_AT, withSpring(1, SLAM_SPRING));
    spin.value = withDelay(SPIN_AT, withTiming(1, { duration: SPIN_MS, easing: Easing.out(Easing.cubic) }));
    together.value = withDelay(TOGETHER_AT, withTiming(1, { duration: 450 }));
    note.value = withDelay(NOTE_AT, withSpring(1, POP_SPRING));
    collapse.value = withDelay(COLLAPSE_AT, withTiming(1, { duration: COLLAPSE_MS, easing: Easing.in(Easing.cubic) }));
    // Pops on landing, bumping the greeting into its wave.
    land.value = withDelay(ENTRY_MS, withSequence(withTiming(1.4, { duration: 90 }), withSpring(1)));
    wave.value = withDelay(
      ENTRY_MS,
      withSequence(
        withTiming(-1, { duration: WAVE_STEP_MS }),
        withTiming(0.8, { duration: WAVE_STEP_MS }),
        withTiming(-0.5, { duration: WAVE_STEP_MS }),
        withTiming(0.3, { duration: WAVE_STEP_MS }),
        withTiming(0, { duration: WAVE_STEP_MS }),
      ),
    );
    const haptic = setTimeout(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light), ENTRY_MS);
    return () => clearTimeout(haptic);
  }, []);

  // Measured before anything in the greeting moves (it only fades until the
  // dot lands), so transforms don't skew it.
  const measureBang = () => {
    const scene = sceneRef.current;
    const dot = bangDotRef.current;
    if (!scene || !dot) return;
    scene.measureInWindow((sx, sy) => {
      dot.measureInWindow((dx, dy, dw, dh) => {
        const point = { x: dx - sx + dw / 2, y: dy - sy + dh / 2 };
        setBang(point);
        onBang(point);
        if (!entry) return;
        hopTo.value = point;
        hopFrom.value = { x: entry.x - sx, y: entry.y - sy };
        // Lands on the beat, however long measuring took.
        const left = Math.max(150, ENTRY_MS - (Date.now() - mountedAt.current));
        fly.value = withTiming(1, { duration: left, easing: Easing.inOut(Easing.cubic) });
      });
    });
  };

  const greetStyle = useAnimatedStyle(() => ({
    opacity: greet.value,
    transform: [{ rotate: `${wave.value * 7}deg` }],
  }));
  const bangDotStyle = useAnimatedStyle(() => ({
    opacity: land.value > 0 ? 1 : 0,
    transform: [{ scale: land.value }],
  }));
  // Onboarding's indicator pill: squeezes into a ball as it hops up.
  const entryStyle = useAnimatedStyle(() => {
    const from = hopFrom.value;
    const to = hopTo.value;
    if (!from) return { opacity: 0 };
    const f = fly.value;
    const w = interpolate(f, [0, 0.25, 1], [ENTRY_SIZE.width, BANG_DOT, BANG_DOT]);
    const h = interpolate(f, [0, 0.25, 1], [ENTRY_SIZE.height, BANG_DOT, BANG_DOT]);
    const x = from.x + (to.x - from.x) * f;
    const y = from.y + (to.y - from.y) * f - ENTRY_ARC * 4 * f * (1 - f);
    return {
      opacity: land.value > 0 ? 0 : 1,
      width: w,
      height: h,
      borderRadius: h / 2,
      transform: [{ translateX: x - w / 2 }, { translateY: y - h / 2 }],
    };
  });
  const slamStyle = useAnimatedStyle(() => ({
    opacity: Math.min(1, slam.value * 3),
    transform: [{ scale: 1.8 - 0.8 * slam.value }],
  }));
  const reelStyle = useAnimatedStyle(() => ({ transform: [{ translateY: -(REEL_LENGTH - 1) * ROW_HEIGHT * spin.value }] }));
  const reelWindowStyle = useAnimatedStyle(() => ({ opacity: spin.value > 0 ? 1 : 0, transform: [{ scale: REEL_SCALE }] }));
  const togetherStyle = useAnimatedStyle(() => ({
    opacity: together.value,
    transform: [{ translateY: 10 * (1 - together.value) }],
  }));
  const noteStyle = useAnimatedStyle(() => ({ opacity: note.value, transform: [{ scale: 0.6 + 0.4 * note.value }, { rotate: "-4deg" }] }));
  // Everything shrinks into the "!"'s dot (where PageIntro's dot takes over).
  const collapseStyle = useAnimatedStyle(() => ({ opacity: 1 - collapse.value, transform: [{ scale: 1 - 0.85 * collapse.value }] }));

  return (
    <View ref={sceneRef} collapsable={false} style={StyleSheet.absoluteFill}>
      <Animated.View
        style={[StyleSheet.absoluteFill, { transformOrigin: bang ? [bang.x, bang.y, 0] : "center" }, collapseStyle]}
        className="items-center"
      >
        <Animated.View style={[{ marginTop: size.h * 0.12 }, greetStyle]} className="items-center">
          <Text className="font-inter-extrabold text-subhero tracking-display text-ink-emphasis">Hey,</Text>
          <View className="flex-row items-end">
            <Text className="font-inter-extrabold text-subhero tracking-display text-ink-emphasis">welcome</Text>
            <View className="ml-1 items-center" style={{ marginBottom: BANG_BASELINE }}>
              <View className="bg-accent" style={{ width: BANG_STEM_W, height: BANG_STEM_H, borderRadius: BANG_STEM_W / 2 }} />
              <Animated.View
                ref={bangDotRef}
                collapsable={false}
                onLayout={measureBang}
                className="bg-accent"
                style={[{ marginTop: BANG_GAP, width: BANG_DOT, height: BANG_DOT, borderRadius: BANG_DOT / 2 }, bangDotStyle]}
              />
            </View>
          </View>
        </Animated.View>

        <Animated.View style={slamStyle} className="mt-8">
          <Text className="text-center font-inter-extrabold text-heading-lg tracking-display text-ink-emphasis">
            Ano <Text className="text-accent">ulam</Text> mo today?
          </Text>
        </Animated.View>

        {/* Slot-machine window: one row visible, soft white fades top and
            bottom so the spin reads as a reel. */}
        <Animated.View
          className="mt-2 self-stretch overflow-hidden"
          style={[{ height: ROW_HEIGHT, marginVertical: REEL_GROWTH }, reelWindowStyle]}
        >
          <Animated.View style={reelStyle}>
            {DISHES.map((dish, i) => (
              <Text
                key={i}
                style={{ height: ROW_HEIGHT, lineHeight: ROW_HEIGHT }}
                className="text-center font-inter-extrabold text-heading-lg tracking-display text-ink-subtle"
              >
                {dish}
              </Text>
            ))}
            <Text
              style={{ height: ROW_HEIGHT, lineHeight: ROW_HEIGHT }}
              className="text-center font-inter-extrabold text-heading-lg tracking-display text-ink-emphasis"
            >
              Ask <Text className="text-primary">Ano</Text>
              <Text className="text-accent">Ulam.</Text>
            </Text>
          </Animated.View>
          <LinearGradient
            pointerEvents="none"
            colors={[colors.white, "rgba(255,255,255,0)", "rgba(255,255,255,0)", colors.white]}
            locations={[0, 0.3, 0.7, 1]}
            style={StyleSheet.absoluteFill}
          />
        </Animated.View>

        <Animated.View style={togetherStyle} className="mt-4">
          <Text className="text-center font-inter-medium text-subheading text-ink-subtle">We&apos;ll figure it out together.</Text>
        </Animated.View>

        <Animated.View style={noteStyle} className="mt-6">
          <Text className="font-handwritten text-heading-lg text-accent">Tara, kain!</Text>
        </Animated.View>
      </Animated.View>

      {/* Onboarding's indicator dot, on its way to the "!". */}
      {entry && <Animated.View pointerEvents="none" className="bg-accent" style={[{ position: "absolute", left: 0, top: 0 }, entryStyle]} />}
    </View>
  );
}

type HomeIntroProps = {
  active: boolean;
  targetRef: RefObject<View | null>;
  onDone: () => void;
  /** Where onboarding's indicator dot was, in window coordinates. Without
   *  it the "!"'s dot just pops in. */
  entry?: Point;
};

export function HomeIntro({ active, targetRef, onDone, entry }: HomeIntroProps) {
  const bang = useRef<Point | null>(null);
  return (
    <PageIntro
      active={active}
      targetRef={targetRef}
      onDone={onDone}
      // Takes off from the "!"'s dot, once the scene has collapsed into it.
      dotStart={(size) => bang.current ?? center(size)}
      dotAt={DOT_AT}
      flyAt={FLY_AT}
      dotSize={BANG_DOT}
      accessibilityLabel="Hey, welcome! Ano ulam mo today? Ask AnoUlam. We'll figure it out together."
    >
      {(size) => (
        <WelcomeScene
          size={size}
          entry={entry}
          onBang={(p) => {
            bang.current = p;
          }}
        />
      )}
    </PageIntro>
  );
}
