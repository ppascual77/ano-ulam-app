import { useEffect } from "react";
import { ScrollView, Text, View } from "react-native";
import Animated, { Easing, FadeIn, FadeInDown, useAnimatedStyle, useSharedValue, withDelay, withTiming } from "react-native-reanimated";
import * as Haptics from "expo-haptics";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { AppText, Button } from "@/frontend/components/ui";
import { colors } from "@/frontend/constants/theme";
import { useReduceMotion } from "@/frontend/core/preferences/store/useReduceMotionStore";
import { useProSubscription } from "../store/useProStore";
import { formatPlanDate, planName } from "../subscriptionCopy";
import { TRIAL_DAYS } from "../proContent";
import { UNLOCKED_FEATURES, type UnlockedFeature } from "./unlockedFeatures";
import { ProFeatureRow } from "./ProFeatureRow";

type ProUnlockOverlayProps = {
  /** "Start exploring". */
  onDone: () => void;
};

// Animated.Views take plain styles only (classes go on a plain View inside):
// NativeWind can drop classes on them, or knock out the animated values.
//
// The timeline, in ms from the overlay appearing. Calm and quick: the lock
// fades in, its shackle lifts open, then the text and the list fade up.
const T = {
  lockIn: 100,
  open: 650,
  headline: 1050,
  list: 1300,
  rowStagger: 60,
};
const EASE = Easing.out(Easing.cubic);

// The padlock, drawn with Views: an orange body and a dark shackle. Opening
// lifts the shackle straight up, so its left leg comes clear of the body
// while the right one (a post that rides with it) stays inside: the classic
// "unlocked" padlock.
const BODY = { width: 88, height: 64, top: 52 };
const SHACKLE = { width: 52, arch: 52, stroke: 9, left: 18, post: 26 };
const LIFT = 18;

function Padlock({ reduceMotion }: { reduceMotion: boolean }) {
  const shown = useSharedValue(reduceMotion ? 1 : 0);
  const open = useSharedValue(reduceMotion ? 1 : 0);

  useEffect(() => {
    if (reduceMotion) return;
    shown.value = withDelay(T.lockIn, withTiming(1, { duration: 320, easing: EASE }));
    open.value = withDelay(T.open, withTiming(1, { duration: 360, easing: EASE }));
    // Runs once, on mount.
  }, []);

  const lockStyle = useAnimatedStyle(() => ({
    opacity: shown.value,
    transform: [{ translateY: 8 * (1 - shown.value) }],
  }));
  const shackleStyle = useAnimatedStyle(() => ({ transform: [{ translateY: -LIFT * open.value }] }));

  return (
    <Animated.View style={[{ width: BODY.width, height: BODY.top + BODY.height }, lockStyle]}>
      {/* Shackle first, so the body covers its legs. */}
      <Animated.View style={[{ position: "absolute", left: SHACKLE.left, top: 0 }, shackleStyle]}>
        <View
          style={{
            width: SHACKLE.width,
            height: SHACKLE.arch,
            borderWidth: SHACKLE.stroke,
            borderBottomWidth: 0,
            borderColor: colors.ink.emphasis,
            borderTopLeftRadius: SHACKLE.width / 2,
            borderTopRightRadius: SHACKLE.width / 2,
          }}
        />
        <View
          style={{
            position: "absolute",
            left: SHACKLE.width - SHACKLE.stroke,
            top: SHACKLE.arch - 1,
            width: SHACKLE.stroke,
            height: SHACKLE.post,
            backgroundColor: colors.ink.emphasis,
          }}
        />
      </Animated.View>
      <View
        className="absolute items-center justify-center rounded-2xl bg-brand-orange"
        style={{ top: BODY.top, width: BODY.width, height: BODY.height }}
      >
        <View className="h-4 w-4 rounded-full bg-white" />
        <View className="-mt-1 h-4 w-1.5 rounded-full bg-white" />
      </View>
    </Animated.View>
  );
}

// One unlocked feature (ProFeatureRow), fading up in its turn.
function FeatureRow({ feature, index, reduceMotion }: { feature: UnlockedFeature; index: number; reduceMotion: boolean }) {
  return (
    <Animated.View
      entering={reduceMotion ? FadeIn.duration(200) : FadeInDown.delay(T.list + index * T.rowStagger).duration(320).easing(EASE)}
    >
      <ProFeatureRow feature={feature} />
    </Animated.View>
  );
}

// The "You're Pro." screen after the (mock) trial starts: the lock opening,
// then what Pro now includes. Plain white, covering the Pro page it's
// rendered in.
export function ProUnlockOverlay({ onDone }: ProUnlockOverlayProps) {
  const insets = useSafeAreaInsets();
  const reduceMotion = useReduceMotion();
  const subscription = useProSubscription();

  // A light haptic as the lock opens (straight away with Reduce motion on).
  useEffect(() => {
    const timer = setTimeout(
      () => void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success),
      reduceMotion ? 0 : T.open,
    );
    return () => clearTimeout(timer);
  }, [reduceMotion]);

  const trialEnd = subscription?.trialEndsAt ? formatPlanDate(subscription.trialEndsAt) : null;
  const fadeUp = (delay: number) => (reduceMotion ? FadeIn.duration(200) : FadeInDown.delay(delay).duration(360).easing(EASE));
  const listEnd = T.list + UNLOCKED_FEATURES.length * T.rowStagger;

  return (
    <Animated.View
      entering={FadeIn.duration(200)}
      style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: colors.white }}
    >
      <View style={{ flex: 1, paddingTop: insets.top, paddingBottom: insets.bottom }}>
        <ScrollView contentContainerClassName="px-6 pb-6" showsVerticalScrollIndicator={false}>
          <View className="items-center pt-10">
            <Padlock reduceMotion={reduceMotion} />
          </View>

          <Animated.View entering={fadeUp(T.headline)}>
            <View className="mt-8 items-center">
              <AppText variant="sectionTitle" dot className="text-center">
                You&apos;re Pro
              </AppText>
              <Text className="mt-1 text-center font-inter-regular text-body text-ink-subtle">
                {subscription ? `${planName(subscription.plan)} is on. ` : ""}
                {trialEnd ? `Your ${TRIAL_DAYS}-day free trial runs until ${trialEnd}.` : "Everything below is yours now."}
              </Text>
            </View>
          </Animated.View>

          <Animated.View entering={fadeUp(T.list - 100)}>
            <Text className="mt-8 font-inter-bold text-small uppercase text-ink-subtle">Now included</Text>
          </Animated.View>
          <View className="mt-1">
            {UNLOCKED_FEATURES.map((feature, i) => (
              <FeatureRow key={feature.key} feature={feature} index={i} reduceMotion={reduceMotion} />
            ))}
          </View>
        </ScrollView>

        <Animated.View entering={fadeUp(listEnd)}>
          <View className="border-t border-ink-emphasis/10 px-6 pb-2 pt-3">
            <Button label="Start exploring" onPress={onDone} />
            <Text className="mt-2 text-center font-inter-regular text-sub text-ink-subtle">Manage or cancel anytime in Settings.</Text>
          </View>
        </Animated.View>
      </View>
    </Animated.View>
  );
}
