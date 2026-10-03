import { useEffect, useState } from "react";
import { Modal, Pressable, Text, View, useWindowDimensions } from "react-native";
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";
import { X } from "lucide-react-native";
import { colors } from "@/frontend/constants/theme";
import type { ProfileTab } from "../ProfileTabBar";

export const PROFILE_TOUR_ID = "profile_tabs";

export const PROFILE_TOUR_STEPS: { target: ProfileTab; title: string; body: string }[] = [
  {
    target: "saved",
    title: "Your saved meals",
    body: "Every meal you've bookmarked lives here. Once you've saved a few, your nutrition summary shows up right alongside them.",
  },
  {
    target: "recipes",
    title: "Recipes you've created",
    body: "Recipes you've uploaded: drafts, ones in review, and ones already live for the community.",
  },
  {
    target: "grocery",
    title: "Your grocery list",
    body: "Ingredients from your saved meals and meal plans, combined into one shopping list ready to check off.",
  },
  {
    target: "pantry",
    title: "What's in your kitchen?",
    body: "Add ingredients you already have and we'll suggest meals you can cook with them right now.",
  },
];

const PAD = 4;
const DIM = "rgba(15,23,42,0.6)";
// Cut-out corner radius (matches the ring's rounded-xl).
const RADIUS = 12;
const MOVE = { duration: 300 };

type Rect = { x: number; y: number; width: number; height: number };

type ProfileTourProps = {
  visible: boolean;
  /** Measures a tab's on-screen position (window coordinates). */
  measure: (tab: ProfileTab) => Promise<Rect | null>;
  /** Dismiss, the close X and Done all end (and complete) the tour. */
  onFinish: () => void;
};

// Spotlight tour over the profile's tab bar: dims the screen except the
// current tab, with a card under it. The cut-out slides between tabs.
export function ProfileTour({ visible, measure, onFinish }: ProfileTourProps) {
  const { width: screenWidth, height: screenHeight } = useWindowDimensions();
  const [step, setStep] = useState(0);
  const [rect, setRect] = useState<Rect | null>(null);
  const x = useSharedValue(0);
  const y = useSharedValue(0);
  const w = useSharedValue(0);
  const h = useSharedValue(0);

  useEffect(() => {
    if (visible) setStep(0);
  }, [visible]);

  useEffect(() => {
    if (!visible) return;
    let cancelled = false;
    void measure(PROFILE_TOUR_STEPS[step].target).then((next) => {
      if (cancelled || !next) return;
      const padded = { x: next.x - PAD, y: next.y - PAD, width: next.width + PAD * 2, height: next.height + PAD * 2 };
      // First step jumps into place; later ones slide.
      const animate = step > 0 && w.value > 0;
      x.value = animate ? withTiming(padded.x, MOVE) : padded.x;
      y.value = animate ? withTiming(padded.y, MOVE) : padded.y;
      w.value = animate ? withTiming(padded.width, MOVE) : padded.width;
      h.value = animate ? withTiming(padded.height, MOVE) : padded.height;
      setRect(padded);
    });
    return () => {
      cancelled = true;
    };
  }, [visible, step, measure, x, y, w, h]);

  // The dim layer is one view with a border thick enough to cover the
  // whole screen; its hollow middle is the cut-out. The outer radius minus
  // the border width leaves the hole with RADIUS corners.
  const dimBorder = Math.max(screenWidth, screenHeight);
  const dimStyle = useAnimatedStyle(() => ({
    top: y.value - dimBorder,
    left: x.value - dimBorder,
    width: w.value + dimBorder * 2,
    height: h.value + dimBorder * 2,
  }));
  const ringStyle = useAnimatedStyle(() => ({ top: y.value, left: x.value, width: w.value, height: h.value }));

  const current = PROFILE_TOUR_STEPS[step];
  const isLast = step === PROFILE_TOUR_STEPS.length - 1;
  const cardTop = rect ? Math.min(rect.y + rect.height + 12, screenHeight - 220) : 0;

  return (
    <Modal visible={visible} transparent animationType="fade" statusBarTranslucent onRequestClose={onFinish}>
      {rect && (
        <View className="flex-1">
          <Animated.View
            pointerEvents="none"
            style={[
              { position: "absolute", borderWidth: dimBorder, borderColor: DIM, borderRadius: dimBorder + RADIUS },
              dimStyle,
            ]}
          />
          <Animated.View pointerEvents="none" style={[{ position: "absolute", borderRadius: RADIUS }, ringStyle]} className="border-2 border-white" />

          <View
            className="absolute gap-3 rounded-2xl bg-white p-4 shadow-lg"
            style={{ top: cardTop, left: 16, width: screenWidth - 32 }}
          >
            <View className="flex-row items-center justify-between">
              <Text className="font-inter-bold text-sub uppercase text-brand-green">
                {step + 1}/{PROFILE_TOUR_STEPS.length}
              </Text>
              <Pressable onPress={onFinish} hitSlop={10} accessibilityLabel="Close tour">
                <X color={colors.webInk.faint} size={16} />
              </Pressable>
            </View>
            <View>
              <Text className="font-inter-bold text-body text-web-ink">{current.title}</Text>
              <Text className="mt-1 font-inter-regular text-small text-web-ink-body">{current.body}</Text>
            </View>
            <View className="flex-row items-center justify-between">
              <Pressable onPress={onFinish} hitSlop={8}>
                <Text className="font-inter-semibold text-small text-web-ink-muted">Dismiss</Text>
              </Pressable>
              <Pressable
                onPress={() => (isLast ? onFinish() : setStep((s) => s + 1))}
                className="rounded-full bg-brand-green px-4 py-2"
              >
                <Text className="font-inter-semibold text-small text-white">{isLast ? "Done" : "Next"}</Text>
              </Pressable>
            </View>
          </View>
        </View>
      )}
    </Modal>
  );
}
