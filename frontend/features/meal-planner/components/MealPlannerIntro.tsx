import { type RefObject, useEffect } from "react";
import { StyleSheet, Text, View } from "react-native";
import Animated, {
  Easing,
  FadeInDown,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import { PageIntro, type IntroSize } from "@/frontend/components/ui";
import { colors } from "@/frontend/constants/theme";
import { useCountTo } from "@/frontend/core/prices/hooks/useCountTo";

// A quick glance at what the Meal Planner does:
//   0.0s   "One budget. / Seven days." rises in
//   0.3s   a weekly budget counts up
//   0.4s   the week's seven day tiles pop in
//   0.7s   three meal dots drop into each day, column by column
//   1.55s  "grocery list included!" (handwritten) pops in
//   2.3s   everything collapses into one dot
//   2.7s   the cover fades to the planner as the dot arcs up and lands as
//          the period of "Let's plan your week." (see PageIntro)
const BUDGET_AT = 300;
const BUDGET_MS = 1300;
// Counts in ₱10 steps: a steady roll instead of a blur of random digits.
const BUDGET_STEP = 10;
const DAYS_AT = 400;
const DAY_STAGGER_MS = 60;
const MEALS_AT = 700;
const MEAL_STAGGER_MS = 35;
const NOTE_AT = 1550;
const COLLAPSE_AT = 2300;
const COLLAPSE_MS = 380;
const DOT_AT = COLLAPSE_AT + 60;
const FLY_AT = 2700;

// An example weekly budget for the counter (not the user's).
const SAMPLE_BUDGET = 1500;
const DAYS = ["M", "T", "W", "T", "F", "S", "S"];
// Breakfast, lunch, dinner: alternating like the confetti's green/orange.
const MEAL_COLORS = [colors.primary, colors.accent, colors.primary];
const TILE_W = 40;
const MEAL_DOT = 10;
const POP_SPRING = { damping: 8, stiffness: 220, mass: 0.5 };

const collapsePoint = (size: IntroSize) => ({ x: size.w / 2, y: size.h / 2 });

function Pop({ delay, children, className }: { delay: number; children?: React.ReactNode; className?: string }) {
  const pop = useSharedValue(0);
  useEffect(() => {
    pop.value = withDelay(delay, withSpring(1, POP_SPRING));
  }, [pop, delay]);
  const style = useAnimatedStyle(() => ({ opacity: Math.min(1, pop.value * 2), transform: [{ scale: pop.value }] }));
  return (
    <Animated.View style={style} className={className}>
      {children}
    </Animated.View>
  );
}

function WeekScene({ size }: { size: IntroSize }) {
  const budget = useCountTo(0, SAMPLE_BUDGET, BUDGET_AT, BUDGET_MS);
  const note = useSharedValue(0);
  const collapse = useSharedValue(0);
  useEffect(() => {
    note.value = withDelay(NOTE_AT, withSpring(1, POP_SPRING));
    collapse.value = withDelay(COLLAPSE_AT, withTiming(1, { duration: COLLAPSE_MS, easing: Easing.in(Easing.cubic) }));
  }, [note, collapse]);
  const noteStyle = useAnimatedStyle(() => ({ opacity: note.value, transform: [{ scale: 0.6 + 0.4 * note.value }, { rotate: "-4deg" }] }));
  // The whole scene shrinks into the middle of the screen (where the dot
  // appears) and fades.
  const collapseStyle = useAnimatedStyle(() => ({ opacity: 1 - collapse.value, transform: [{ scale: 1 - 0.85 * collapse.value }] }));

  return (
    <Animated.View style={[StyleSheet.absoluteFill, collapseStyle]}>
      <Animated.View entering={FadeInDown.duration(500)} className="items-center" style={{ marginTop: size.h * 0.12 }}>
        <Text className="font-inter-medium text-subheading text-ink-subtle">One budget.</Text>
        <Text className="font-inter-extrabold text-subhero tracking-display text-primary">
          Seven days<Text className="text-accent">.</Text>
        </Text>
      </Animated.View>

      <Animated.View entering={FadeInDown.delay(250).duration(450)} className="mt-3 flex-row items-baseline justify-center gap-2">
        <Text style={{ fontVariant: ["tabular-nums"] }} className="font-inter-extrabold text-heading-lg text-primary">
          ₱{(Math.round(budget / BUDGET_STEP) * BUDGET_STEP).toLocaleString("en-PH")}
        </Text>
        <Text className="font-inter-bold text-subheading text-ink-emphasis">a week</Text>
      </Animated.View>

      {/* The week filling up: a tile per day, three meals dropping into each. */}
      <View className="mt-10 flex-row justify-center gap-2">
        {DAYS.map((day, d) => (
          <Pop key={d} delay={DAYS_AT + d * DAY_STAGGER_MS}>
            <View
              className="items-center gap-2 rounded-2xl border border-ink-emphasis/10 bg-mood-bg py-3"
              style={{ width: TILE_W }}
            >
              <Text className="font-inter-bold text-small text-ink-emphasis">{day}</Text>
              {MEAL_COLORS.map((color, m) => (
                <Pop key={m} delay={MEALS_AT + (d * MEAL_COLORS.length + m) * MEAL_STAGGER_MS}>
                  <View style={{ width: MEAL_DOT, height: MEAL_DOT, borderRadius: MEAL_DOT / 2, backgroundColor: color }} />
                </Pop>
              ))}
            </View>
          </Pop>
        ))}
      </View>

      <Animated.View className="mt-6 items-center" style={noteStyle}>
        <Text className="font-handwritten text-heading-lg text-accent">grocery list included!</Text>
      </Animated.View>
    </Animated.View>
  );
}

type MealPlannerIntroProps = {
  active: boolean;
  targetRef: RefObject<View | null>;
  onDone: () => void;
};

export function MealPlannerIntro({ active, targetRef, onDone }: MealPlannerIntroProps) {
  return (
    <PageIntro
      active={active}
      targetRef={targetRef}
      onDone={onDone}
      dotStart={collapsePoint}
      dotAt={DOT_AT}
      flyAt={FLY_AT}
      accessibilityLabel="Meal Planner: set one budget and get seven days of meals, with the grocery list included."
    >
      {(size) => <WeekScene size={size} />}
    </PageIntro>
  );
}
