import { type RefObject, useEffect } from "react";
import { StyleSheet, Text, View } from "react-native";
import { Image } from "expo-image";
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
import { CATEGORIES } from "@/frontend/core/budget/components/CategoriesSection";

// The welcome right after onboarding, in the same style as the page intros:
//   0.0s   "You're all set!" / "AnoUlam mo today?" rises in
//   0.5s   the four meal categories pop in, one after another
//   1.5s   "we'll find your ulam!" (handwritten) pops under them
//   2.3s   everything collapses into one dot
//   2.7s   the cover fades to Home as the dot arcs up and lands as the
//          period of "Categories." (see PageIntro)
const TILES_AT = 500;
const TILE_STAGGER_MS = 120;
const NOTE_AT = 1500;
const COLLAPSE_AT = 2300;
const COLLAPSE_MS = 380;
const DOT_AT = COLLAPSE_AT + 60;
const FLY_AT = 2700;

const TILTS = ["-5deg", "3deg", "-2deg", "5deg"];
const POP_SPRING = { damping: 8, stiffness: 220, mass: 0.5 };

const collapsePoint = (size: IntroSize) => ({ x: size.w / 2, y: size.h / 2 });

function CategoryTile({ category, index }: { category: (typeof CATEGORIES)[number]; index: number }) {
  const pop = useSharedValue(0);
  useEffect(() => {
    pop.value = withDelay(TILES_AT + index * TILE_STAGGER_MS, withSpring(1, POP_SPRING));
  }, [pop, index]);
  const tilt = TILTS[index % TILTS.length];
  const style = useAnimatedStyle(() => ({ opacity: Math.min(1, pop.value * 2), transform: [{ scale: pop.value }, { rotate: tilt }] }));
  return (
    <Animated.View
      style={[{ borderRadius: 8, borderWidth: 2, paddingVertical: 10 }, style]}
      className={`flex-1 items-center ${category.bgClassName} ${category.borderClassName}`}
    >
      <Image source={category.image} style={{ width: 48, height: 48 }} contentFit="contain" />
      <Text className="mt-1 font-inter-semibold text-small text-ink-emphasis">{category.label}</Text>
    </Animated.View>
  );
}

function WelcomeScene({ size }: { size: IntroSize }) {
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
      <Animated.View entering={FadeInDown.duration(450)} className="items-center" style={{ marginTop: size.h * 0.16 }}>
        <Text className="font-inter-medium text-subheading text-ink-subtle">You&apos;re all set!</Text>
        <Text className="font-inter-extrabold text-subhero tracking-display">
          <Text className="text-primary">Ano</Text>
          <Text className="text-accent">Ulam</Text>
        </Text>
        <Text className="font-inter-bold text-subheading text-ink-emphasis">mo today?</Text>
      </Animated.View>

      <View className="mt-10 flex-row gap-2 px-6">
        {CATEGORIES.map((category, i) => (
          <CategoryTile key={category.id} category={category} index={i} />
        ))}
      </View>

      <Animated.View className="mt-6 items-center" style={noteStyle}>
        <Text className="font-handwritten text-heading-lg text-accent">we&apos;ll find your ulam!</Text>
      </Animated.View>
    </Animated.View>
  );
}

type HomeIntroProps = {
  active: boolean;
  targetRef: RefObject<View | null>;
  onDone: () => void;
};

export function HomeIntro({ active, targetRef, onDone }: HomeIntroProps) {
  return (
    <PageIntro
      active={active}
      targetRef={targetRef}
      onDone={onDone}
      dotStart={collapsePoint}
      dotAt={DOT_AT}
      flyAt={FLY_AT}
      accessibilityLabel="You're all set. Pick a category, breakfast, lunch, dinner or fast food, and we'll find your ulam."
    >
      {(size) => <WelcomeScene size={size} />}
    </PageIntro>
  );
}
