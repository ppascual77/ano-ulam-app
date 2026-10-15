import { type RefObject, useEffect } from "react";
import { StyleSheet, Text, View } from "react-native";
import Animated, {
  Easing,
  FadeInDown,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSequence,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import { BicepsFlexed, PiggyBank, Timer, type LucideIcon } from "lucide-react-native";
import { INTRO_DOT_REST_MS, PageIntro, type IntroSize } from "@/frontend/components/ui";
import { colors } from "@/frontend/constants/theme";

// A quick glance at what Browse is, a magnifier over every dish:
//   0.0s   "What are you craving?" rises in over a field of faint dish names
//   0.3s   a magnifying glass glides over the field; whatever's under the
//          lens shows big and sharp
//   2.0s   it slows and stops on one dish, which turns orange
//   2.1s   "sounds good today!" (handwritten) pops under it
//   2.3s   the three ulam moods pop in: Tipid, High Protein, Quick & Easy
//   2.9s   everything shrinks into the lens's middle, where the dot
//          appears, settles, then arcs up and lands as the period of the
//          "Browse." header (see PageIntro)
const FIELD_AT = 100;
const LENS_AT = 300;
const STOP_AT = 2000;
const NOTE_AT = 2100;
const MOODS_AT = 2300;
const MOOD_STAGGER_MS = 110;
const COLLAPSE_AT = 2900;
const COLLAPSE_MS = 380;
const DOT_AT = COLLAPSE_AT + 60;
const FLY_AT = DOT_AT + INTRO_DOT_REST_MS;

// The field: where each dish sits, as fractions of the field's box. The
// last is the one the lens stops on.
const FIELD: { name: string; x: number; y: number }[] = [
  { name: "Adobo", x: 0.2, y: 0.06 },
  { name: "Tinola", x: 0.72, y: 0.02 },
  { name: "Laing", x: 0.48, y: 0.18 },
  { name: "Bulalo", x: 0.14, y: 0.32 },
  { name: "Pancit", x: 0.82, y: 0.28 },
  { name: "Menudo", x: 0.36, y: 0.44 },
  { name: "Lechon", x: 0.86, y: 0.42 },
  { name: "Kare-Kare", x: 0.2, y: 0.66 },
  { name: "Paksiw", x: 0.6, y: 0.74 },
  { name: "Afritada", x: 0.3, y: 0.9 },
  { name: "Tortang Talong", x: 0.74, y: 0.94 },
  { name: "Sinigang", x: 0.6, y: 0.58 },
];
const TARGET = FIELD[FIELD.length - 1];
// The field's box, as fractions of the screen.
const FIELD_TOP = 0.3;
const FIELD_HEIGHT = 0.36;
const FIELD_SIDE = 28;
const ITEM_W = 140;
const ITEM_H = 24;

const LENS_R = 58;
const LENS_RIM = 5;
// The handle: a bar out of the rim's lower right, on the lens's 45° diagonal
// so it points straight out from the middle. Its middle sits HANDLE_REACH
// from the lens's middle (starting just inside the rim, so they join).
const HANDLE_W = 12;
const HANDLE_L = 52;
const HANDLE_REACH = (LENS_R - LENS_RIM / 2 + HANDLE_L / 2) / Math.SQRT2;
const ZOOM = 1.8;
// The lens's path in field fractions: in from the lower left, a wander, then
// the target.
const PATH = [
  { x: -0.15, y: 1.1 },
  { x: 0.22, y: 0.7 },
  { x: 0.42, y: 0.2 },
  { x: 0.78, y: 0.36 },
];
const LEG_MS = (STOP_AT - LENS_AT) / PATH.length;

const MOODS: { label: string; icon: LucideIcon; tilt: string }[] = [
  { label: "Tipid Meals", icon: PiggyBank, tilt: "-4deg" },
  { label: "High Protein", icon: BicepsFlexed, tilt: "2deg" },
  { label: "Quick & Easy", icon: Timer, tilt: "5deg" },
];
const POP_SPRING = { damping: 8, stiffness: 220, mass: 0.5 };

type Point = { x: number; y: number };

// A field fraction to scene coordinates.
const toScene = (size: IntroSize, p: Point): Point => ({
  x: FIELD_SIDE + p.x * (size.w - FIELD_SIDE * 2),
  y: size.h * FIELD_TOP + p.y * size.h * FIELD_HEIGHT,
});
const targetPoint = (size: IntroSize) => toScene(size, TARGET);

function MoodChip({ label, icon: Icon, tilt, index }: { label: string; icon: LucideIcon; tilt: string; index: number }) {
  const pop = useSharedValue(0);
  useEffect(() => {
    pop.value = withDelay(MOODS_AT + index * MOOD_STAGGER_MS, withSpring(1, POP_SPRING));
  }, [pop, index]);
  const style = useAnimatedStyle(() => ({ opacity: Math.min(1, pop.value * 2), transform: [{ scale: pop.value }, { rotate: tilt }] }));
  return (
    <Animated.View style={style} className="flex-row items-center gap-1.5 rounded-full border border-ink-emphasis/10 bg-mood-bg px-3 py-2">
      <Icon color={colors.primary} size={16} />
      <Text className="font-inter-semibold text-small text-ink-emphasis">{label}</Text>
    </Animated.View>
  );
}

// Every dish in place. `sharp` is the copy seen through the lens.
function Field({ size, sharp }: { size: IntroSize; sharp: boolean }) {
  return (
    <>
      {FIELD.map((dish) => {
        const p = toScene(size, dish);
        const isTarget = dish === TARGET;
        return (
          <View
            key={dish.name}
            style={{ position: "absolute", left: p.x - ITEM_W / 2, top: p.y - ITEM_H / 2, width: ITEM_W, height: ITEM_H }}
            className="items-center justify-center"
          >
            <Text
              numberOfLines={1}
              // Brand green: faint in the field, full strength through the
              // lens; the dish it finds is orange.
              className={`font-inter-semibold text-body ${
                isTarget ? (sharp ? "text-accent" : "text-accent/40") : sharp ? "text-primary" : "text-primary/30"
              }`}
            >
              {dish.name}
            </Text>
          </View>
        );
      })}
    </>
  );
}

function MagnifierScene({ size }: { size: IntroSize }) {
  const target = targetPoint(size);
  const path = PATH.map((p) => toScene(size, p));
  const field = useSharedValue(0);
  const lensX = useSharedValue(path[0].x);
  const lensY = useSharedValue(path[0].y);
  const lens = useSharedValue(0);
  const found = useSharedValue(0);
  const note = useSharedValue(0);
  const collapse = useSharedValue(0);

  useEffect(() => {
    // Fades back once the lens has found its dish, so the note reads clean.
    field.value = withSequence(
      withDelay(FIELD_AT, withTiming(1, { duration: 400 })),
      withDelay(STOP_AT - FIELD_AT - 400, withTiming(0.35, { duration: 300 })),
    );
    lens.value = withDelay(LENS_AT, withSpring(1, POP_SPRING));
    // Leg by leg through the path, the last one easing to a stop.
    const stops = [...path.slice(1), target];
    const leg = (i: number, v: number) =>
      withTiming(v, { duration: LEG_MS, easing: i === stops.length - 1 ? Easing.out(Easing.cubic) : Easing.inOut(Easing.quad) });
    lensX.value = withDelay(LENS_AT, withSequence(...stops.map((p, i) => leg(i, p.x))));
    lensY.value = withDelay(LENS_AT, withSequence(...stops.map((p, i) => leg(i, p.y))));
    found.value = withDelay(STOP_AT, withSequence(withTiming(1.15, { duration: 120 }), withSpring(1)));
    note.value = withDelay(NOTE_AT, withSpring(1, POP_SPRING));
    collapse.value = withDelay(COLLAPSE_AT, withTiming(1, { duration: COLLAPSE_MS, easing: Easing.in(Easing.cubic) }));
  }, []);

  const fieldStyle = useAnimatedStyle(() => ({ opacity: field.value }));
  const lensStyle = useAnimatedStyle(() => ({
    opacity: Math.min(1, lens.value * 2),
    transform: [
      { translateX: lensX.value - LENS_R },
      { translateY: lensY.value - LENS_R },
      { scale: lens.value * (found.value === 0 ? 1 : found.value) },
    ],
  }));
  // The sharp copy, scaled ZOOM times around whatever's under the lens's
  // middle: a scene point p lands at LENS_R + (p - lens) * ZOOM.
  const zoomStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: LENS_R - lensX.value * ZOOM },
      { translateY: LENS_R - lensY.value * ZOOM },
      { scale: ZOOM },
    ],
  }));
  const noteStyle = useAnimatedStyle(() => ({ opacity: note.value, transform: [{ scale: 0.6 + 0.4 * note.value }, { rotate: "-4deg" }] }));
  // Everything shrinks into the lens's middle (the target), where the dot
  // appears.
  const collapseStyle = useAnimatedStyle(() => ({ opacity: 1 - collapse.value, transform: [{ scale: 1 - 0.85 * collapse.value }] }));

  return (
    <Animated.View style={[StyleSheet.absoluteFill, { transformOrigin: [target.x, target.y, 0] }, collapseStyle]}>
      <Animated.View entering={FadeInDown.duration(450)} className="items-center" style={{ marginTop: size.h * 0.16 }}>
        <Text className="font-inter-extrabold text-heading-lg tracking-display text-ink-emphasis">What are you craving?</Text>
      </Animated.View>

      <Animated.View style={[StyleSheet.absoluteFill, fieldStyle]}>
        <Field size={size} sharp={false} />
      </Animated.View>

      {/* The lens: a white window onto the sharp copy, a rim and a handle. */}
      <Animated.View style={[{ position: "absolute", left: 0, top: 0, width: LENS_R * 2, height: LENS_R * 2 }, lensStyle]}>
        <View
          className="absolute bg-ink-emphasis"
          style={{
            width: HANDLE_W,
            height: HANDLE_L,
            borderRadius: HANDLE_W / 2,
            left: LENS_R + HANDLE_REACH - HANDLE_W / 2,
            top: LENS_R + HANDLE_REACH - HANDLE_L / 2,
            // A vertical bar turned 45° counterclockwise runs top-left to
            // bottom-right: along the diagonal.
            transform: [{ rotate: "-45deg" }],
          }}
        />
        <View className="overflow-hidden bg-white" style={{ width: LENS_R * 2, height: LENS_R * 2, borderRadius: LENS_R }}>
          <Animated.View style={[{ position: "absolute", left: 0, top: 0, width: size.w, height: size.h, transformOrigin: [0, 0, 0] }, zoomStyle]}>
            <Field size={size} sharp />
          </Animated.View>
        </View>
        <View
          pointerEvents="none"
          className="absolute border-ink-emphasis"
          style={{ left: 0, top: 0, width: LENS_R * 2, height: LENS_R * 2, borderRadius: LENS_R, borderWidth: LENS_RIM }}
        />
      </Animated.View>

      <Animated.View
        style={[{ position: "absolute", left: 0, right: 0, top: target.y + LENS_R + 26, alignItems: "center" }, noteStyle]}
      >
        <Text className="font-handwritten text-heading-lg text-accent">sounds good today!</Text>
      </Animated.View>

      <View
        style={{ position: "absolute", left: 0, right: 0, top: size.h * (FIELD_TOP + FIELD_HEIGHT) + 120 }}
        className="flex-row flex-wrap justify-center gap-2 px-4"
      >
        {MOODS.map((mood, i) => (
          <MoodChip key={mood.label} {...mood} index={i} />
        ))}
      </View>
    </Animated.View>
  );
}

type BrowseIntroProps = {
  active: boolean;
  targetRef: RefObject<View | null>;
  onDone: () => void;
};

export function BrowseIntro({ active, targetRef, onDone }: BrowseIntroProps) {
  return (
    <PageIntro
      active={active}
      targetRef={targetRef}
      onDone={onDone}
      dotStart={targetPoint}
      dotAt={DOT_AT}
      flyAt={FLY_AT}
      accessibilityLabel="Browse: search any dish you're craving, or pick by mood: tipid, high protein, or quick and easy."
    >
      {(size) => <MagnifierScene size={size} />}
    </PageIntro>
  );
}
