import { useEffect, useState } from "react";
import { Modal, Pressable, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import Animated, {
  Easing,
  FadeIn,
  FadeOut,
  useAnimatedProps,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import Svg, { Path, Rect } from "react-native-svg";
import { X } from "lucide-react-native";
import { AppText } from "@/frontend/components/ui";
import { colors } from "@/frontend/constants/theme";
import type { ProfileTab } from "../ProfileTabBar";

export const PROFILE_TOUR_ID = "profile_tabs";

export const PROFILE_TOUR_STEPS: { target: ProfileTab; title: string; body: string }[] = [
  {
    target: "saved",
    title: "Saved meals",
    body: "Every meal you've bookmarked lives here. Once you've saved a few, your nutrition summary shows up right alongside them.",
  },
  {
    target: "recipes",
    title: "Your recipes",
    body: "Recipes you've uploaded: drafts, ones in review, and ones already live for the community.",
  },
  {
    target: "grocery",
    title: "Grocery list",
    body: "Ingredients from your saved meals and meal plans, combined into one shopping list ready to check off.",
  },
  {
    target: "pantry",
    title: "Your pantry",
    body: "Add ingredients you already have and we'll suggest meals you can cook with them right now.",
  },
];

const PAD = 4;
const DIM = "rgba(15,23,42,0.6)";
// Cut-out corner radius.
const RADIUS = 12;
const RING = 2;
const MOVE = { duration: 320, easing: Easing.out(Easing.cubic) };
// Gap between the cut-out and the card, and the card's distance from the
// screen's bottom edge at most.
const CARD_GAP = 12;
const CARD_BOTTOM_MARGIN = 24;

const AnimatedPath = Animated.createAnimatedComponent(Path);
const AnimatedRect = Animated.createAnimatedComponent(Rect);

type Box = { x: number; y: number; width: number; height: number };

// The screen with a rounded hole in it (even-odd fill: the hole is the
// rounded rect drawn inside the full-screen one).
function dimPath(sw: number, sh: number, x: number, y: number, w: number, h: number) {
  "worklet";
  const r = Math.min(RADIUS, w / 2, h / 2);
  return (
    `M0 0 H${sw} V${sh} H0 Z ` +
    `M${x + r} ${y} H${x + w - r} A${r} ${r} 0 0 1 ${x + w} ${y + r} V${y + h - r} ` +
    `A${r} ${r} 0 0 1 ${x + w - r} ${y + h} H${x + r} A${r} ${r} 0 0 1 ${x} ${y + h - r} ` +
    `V${y + r} A${r} ${r} 0 0 1 ${x + r} ${y} Z`
  );
}

type ProfileTourProps = {
  visible: boolean;
  /** Measures a tab's on-screen position (window coordinates). */
  measure: (tab: ProfileTab) => Promise<Box | null>;
  /** Dismiss, the close X and Done all end (and complete) the tour. */
  onFinish: () => void;
};

// Spotlight tour over the profile's tab bar: dims the screen except the
// current tab, with a card under it. The cut-out, its ring and the card
// all glide to the next tab together.
//
// The dim and ring are one SVG whose shapes animate as props on the UI
// thread, and the card moves by transform, so nothing re-runs layout per
// frame (animating a giant bordered view's top/left/width/height did, and
// stuttered).
export function ProfileTour({ visible, measure, onFinish }: ProfileTourProps) {
  const { width: screenWidth, height: screenHeight } = useWindowDimensions();
  const [step, setStep] = useState(0);
  const [ready, setReady] = useState(false);
  const [cardHeight, setCardHeight] = useState(0);
  const x = useSharedValue(0);
  const y = useSharedValue(0);
  const w = useSharedValue(0);
  const h = useSharedValue(0);
  const cardY = useSharedValue(0);

  // Reset on close, so the next open snaps to step 1 instead of gliding
  // from where the last tour ended.
  useEffect(() => {
    if (!visible) {
      setStep(0);
      setReady(false);
    }
  }, [visible]);

  useEffect(() => {
    if (!visible) return;
    let cancelled = false;
    void measure(PROFILE_TOUR_STEPS[step].target).then((next) => {
      if (cancelled || !next) return;
      const hole = { x: next.x - PAD, y: next.y - PAD, width: next.width + PAD * 2, height: next.height + PAD * 2 };
      const maxCardY = screenHeight - (cardHeight || 240) - CARD_BOTTOM_MARGIN;
      const nextCardY = Math.min(hole.y + hole.height + CARD_GAP, maxCardY);
      // First step jumps into place; later ones glide.
      const glide = (v: number) => (ready ? withTiming(v, MOVE) : v);
      x.value = glide(hole.x);
      y.value = glide(hole.y);
      w.value = glide(hole.width);
      h.value = glide(hole.height);
      cardY.value = glide(nextCardY);
      setReady(true);
    });
    return () => {
      cancelled = true;
    };
    // `ready`/`cardHeight` are read, not reacted to: only a new step moves things.
  }, [visible, step, measure]);

  const dimProps = useAnimatedProps(() => ({ d: dimPath(screenWidth, screenHeight, x.value, y.value, w.value, h.value) }));
  const ringProps = useAnimatedProps(() => ({
    x: x.value + RING / 2,
    y: y.value + RING / 2,
    width: Math.max(0, w.value - RING),
    height: Math.max(0, h.value - RING),
  }));
  const cardStyle = useAnimatedStyle(() => ({ transform: [{ translateY: cardY.value }] }));

  const current = PROFILE_TOUR_STEPS[step];
  const isLast = step === PROFILE_TOUR_STEPS.length - 1;

  return (
    <Modal visible={visible} transparent animationType="fade" statusBarTranslucent onRequestClose={onFinish}>
      {ready && (
        <View className="flex-1">
          <Svg pointerEvents="none" style={StyleSheet.absoluteFill} width={screenWidth} height={screenHeight}>
            <AnimatedPath fill={DIM} fillRule="evenodd" animatedProps={dimProps} />
            <AnimatedRect rx={RADIUS} fill="none" stroke={colors.white} strokeWidth={RING} animatedProps={ringProps} />
          </Svg>

          <Animated.View
            className="absolute gap-4 rounded-3xl bg-white p-5 shadow-lg"
            style={[{ top: 0, left: 16, width: screenWidth - 32 }, cardStyle]}
            onLayout={(e) => setCardHeight(e.nativeEvent.layout.height)}
          >
            <View className="flex-row items-center justify-between">
              <Text className="font-inter-bold text-small text-primary">
                {step + 1} of {PROFILE_TOUR_STEPS.length}
              </Text>
              <Pressable onPress={onFinish} hitSlop={10} accessibilityLabel="Close tour">
                <X color={colors.ink.subtle} size={20} />
              </Pressable>
            </View>

            {/* The step's words cross-fade as the card glides. */}
            <Animated.View key={step} entering={FadeIn.duration(220)} exiting={FadeOut.duration(120)}>
              <AppText variant="sectionSubtitle" dot>
                {current.title}
              </AppText>
              <Text className="mt-1.5 font-inter-regular text-body-lg text-ink">{current.body}</Text>
            </Animated.View>

            <View className="flex-row items-center justify-between">
              <Pressable onPress={onFinish} hitSlop={8}>
                <Text className="font-inter-semibold text-body text-ink-subtle">Dismiss</Text>
              </Pressable>
              <Pressable
                onPress={() => (isLast ? onFinish() : setStep((s) => s + 1))}
                className="rounded-full bg-primary px-6 py-3"
              >
                <Text className="font-inter-semibold text-body text-white">{isLast ? "Done" : "Next"}</Text>
              </Pressable>
            </View>
          </Animated.View>
        </View>
      )}
    </Modal>
  );
}
