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

// The welcome right after onboarding, in the same style as the page intros
// but all words:
//   0.0s   "Welcome to" rises in
//   0.25s  "AnoUlam" rises in under it
//   0.8s   "We're so glad you're here."
//   1.15s  "Your next ulam is just a tap away."
//   1.6s   "Tara, kain!" (handwritten) pops in
//   2.4s   everything collapses into one dot
//   2.8s   the cover fades to Home as the dot arcs up and lands as the
//          period of "Categories." (see PageIntro)
const GLAD_AT = 800;
const TAP_AT = 1150;
const NOTE_AT = 1600;
const COLLAPSE_AT = 2400;
const COLLAPSE_MS = 380;
const DOT_AT = COLLAPSE_AT + 60;
const FLY_AT = 2800;

const POP_SPRING = { damping: 8, stiffness: 220, mass: 0.5 };

const collapsePoint = (size: IntroSize) => ({ x: size.w / 2, y: size.h / 2 });

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
    <Animated.View style={[StyleSheet.absoluteFill, collapseStyle]} className="items-center px-8">
      <View style={{ marginTop: size.h * 0.2 }} />
      <Animated.View entering={FadeInDown.duration(450)}>
        <Text className="font-inter-medium text-subheading text-ink-subtle">Welcome to</Text>
      </Animated.View>
      <Animated.View entering={FadeInDown.delay(250).duration(450)}>
        <Text className="font-inter-extrabold text-subhero tracking-display">
          <Text className="text-primary">Ano</Text>
          <Text className="text-accent">Ulam</Text>
        </Text>
      </Animated.View>

      <Animated.View entering={FadeInDown.delay(GLAD_AT).duration(450)} className="mt-8">
        <Text className="text-center font-inter-bold text-subheading text-ink-emphasis">We&apos;re so glad you&apos;re here.</Text>
      </Animated.View>
      <Animated.View entering={FadeInDown.delay(TAP_AT).duration(450)} className="mt-1">
        <Text className="text-center font-inter-regular text-body text-ink-subtle">Your next ulam is just a tap away.</Text>
      </Animated.View>

      <Animated.View className="mt-8" style={noteStyle}>
        <Text className="font-handwritten text-heading-lg text-accent">Tara, kain!</Text>
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
      accessibilityLabel="Welcome to AnoUlam. We're so glad you're here. Your next ulam is just a tap away."
    >
      {(size) => <WelcomeScene size={size} />}
    </PageIntro>
  );
}
