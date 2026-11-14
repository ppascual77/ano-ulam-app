import { useEffect, useState } from "react";
import { AppState, ScrollView, View } from "react-native";
import { Text } from "@/frontend/components/ui/Text";
import Animated, {
  Easing,
  FadeIn,
  FadeInDown,
  FadeOut,
  FadeOutUp,
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from "react-native-reanimated";
import * as Haptics from "expo-haptics";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { AppText, Button } from "@/frontend/components/ui";
import { colors } from "@/frontend/constants/theme";
import { useReduceMotion } from "@/frontend/core/preferences/store/useReduceMotionStore";
import { useProSubscription } from "../store/useProStore";
import { formatPlanDate, planName } from "../subscriptionCopy";
import { TRIAL_DAYS } from "../proContent";
import { CompareTable } from "./ProCompareTable";
import { COMPARE_ROWS } from "../proContent";

type ProUnlockOverlayProps = {
  /** "confirming": Apple's purchase sheet is up, or the purchase is being
   *  confirmed (the lock tugs at its shackle). "unlocked": it went
   *  through (the lock opens, then what Pro includes). */
  phase: "confirming" | "unlocked";
  /** "Start exploring". */
  onDone: () => void;
};

// Animated.Views take plain styles only (classes go on a plain View inside):
// NativeWind can drop classes on them, or knock out the animated values.
//
// The timeline, in ms. The lock fades in as the overlay appears; the rest
// counts from the unlock: the shackle lifts open, then the text and the
// list fade up.
const T = {
  lockIn: 100,
  open: 150,
  headline: 550,
  list: 800,
  rowStagger: 60,
};
const EASE = Easing.out(Easing.cubic);
// While confirming: every TUG_MS the shackle nudges up and drops back, as
// if trying to open, and a soft ring pulses out from the lock with it.
const TUG_MS = 1100;
const TUG_LIFT = 4;
const RING_SCALE = 1.7;

// The padlock, drawn with Views: an orange body and a dark shackle. Opening
// lifts the shackle straight up, so its left leg comes clear of the body
// while the right one (a post that rides with it) stays inside: the classic
// "unlocked" padlock.
const BODY = { width: 88, height: 64, top: 52 };
const SHACKLE = { width: 52, arch: 52, stroke: 9, left: 18, post: 26 };
const LIFT = 18;

function Padlock({ open: isOpen, reduceMotion }: { open: boolean; reduceMotion: boolean }) {
  const shown = useSharedValue(reduceMotion ? 1 : 0);
  const open = useSharedValue(0);
  const tug = useSharedValue(0);
  // 0 -> 1 once per tug: the ring's swell, then a reset while it's invisible.
  const pulse = useSharedValue(0);

  useEffect(() => {
    if (reduceMotion) return;
    shown.value = withDelay(T.lockIn, withTiming(1, { duration: 320, easing: EASE }));
    // Runs once, on mount.
  }, []);

  useEffect(() => {
    if (isOpen) {
      // The tug settles as the shackle lifts the rest of the way.
      cancelAnimation(tug);
      cancelAnimation(pulse);
      tug.value = withTiming(0, { duration: 120 });
      pulse.value = withTiming(1, { duration: 200 });
      open.value = reduceMotion ? 1 : withDelay(T.open, withTiming(1, { duration: 360, easing: EASE }));
    } else if (!reduceMotion) {
      const start = T.lockIn + 300;
      tug.value = withDelay(
        start,
        withRepeat(
          withSequence(
            withTiming(1, { duration: 180, easing: Easing.out(Easing.quad) }),
            withTiming(0, { duration: 260, easing: Easing.in(Easing.quad) }),
            withTiming(0, { duration: TUG_MS - 440 }),
          ),
          -1,
        ),
      );
      pulse.value = withDelay(
        start,
        withRepeat(
          withSequence(
            withTiming(1, { duration: 700, easing: Easing.out(Easing.quad) }),
            withTiming(0, { duration: 0 }),
            withTiming(0, { duration: TUG_MS - 700 }),
          ),
          -1,
        ),
      );
    }
  }, [isOpen, reduceMotion]);

  const lockStyle = useAnimatedStyle(() => ({
    opacity: shown.value,
    transform: [{ translateY: 8 * (1 - shown.value) }],
  }));
  const shackleStyle = useAnimatedStyle(() => ({ transform: [{ translateY: -LIFT * open.value - TUG_LIFT * tug.value }] }));
  // The ring swells out from the body and fades as it goes. Hidden at 0, so
  // its reset between tugs never shows.
  const ringStyle = useAnimatedStyle(() => ({
    opacity: pulse.value === 0 ? 0 : 0.4 * (1 - pulse.value),
    transform: [{ scale: 1 + (RING_SCALE - 1) * pulse.value }],
  }));

  return (
    <Animated.View style={[{ width: BODY.width, height: BODY.top + BODY.height }, lockStyle]}>
      <Animated.View
        pointerEvents="none"
        style={[
          {
            position: "absolute",
            top: BODY.top,
            width: BODY.width,
            height: BODY.height,
            borderRadius: 16,
            borderWidth: 2,
            borderColor: colors.brandOrange,
          },
          ringStyle,
        ]}
      />
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

// Under the closed lock while confirming, by where the purchase is: Apple's
// sheet still opening, open (the app goes inactive under it), then back
// with us while RevenueCat confirms the receipt.
type ConfirmStep = "opening" | "inSheet" | "confirming";
const CONFIRM_CAPTION: Record<ConfirmStep, string> = {
  opening: "Opening the App Store...",
  inSheet: "Finish up in the App Store",
  confirming: "Confirming with Apple...",
};
// If the app never goes inactive (Apple's sheet doesn't always do that),
// move on from "Opening" anyway.
const OPENING_FALLBACK_MS = 2500;

function useConfirmStep(active: boolean): ConfirmStep {
  const [step, setStep] = useState<ConfirmStep>("opening");
  useEffect(() => {
    if (!active) return;
    const sub = AppState.addEventListener("change", (state) => {
      if (state === "active") setStep("confirming");
      else setStep((current) => (current === "confirming" ? current : "inSheet"));
    });
    const timer = setTimeout(() => setStep((current) => (current === "opening" ? "confirming" : current)), OPENING_FALLBACK_MS);
    return () => {
      sub.remove();
      clearTimeout(timer);
    };
  }, [active]);
  return step;
}

// Starting Pro, in one place: from the tap until the purchase settles
// ("confirming"), the closed padlock tugs at its shackle with a caption
// for each step; when it goes through ("unlocked") the same lock opens,
// then "You're Pro" and what Pro now includes fade up where the caption
// was. Plain white, covering the Pro page it's rendered in; cancelling in
// Apple's sheet just fades it away (the Pro page unmounts it).
export function ProUnlockOverlay({ phase, onDone }: ProUnlockOverlayProps) {
  const insets = useSafeAreaInsets();
  const reduceMotion = useReduceMotion();
  const subscription = useProSubscription();
  const unlocked = phase === "unlocked";
  const step = useConfirmStep(!unlocked);

  // A light haptic as the lock opens (straight away with Reduce motion on).
  useEffect(() => {
    if (!unlocked) return;
    const timer = setTimeout(
      () => void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success),
      reduceMotion ? 0 : T.open,
    );
    return () => clearTimeout(timer);
  }, [unlocked, reduceMotion]);

  const trialEnd = subscription?.trialEndsAt ? formatPlanDate(subscription.trialEndsAt) : null;
  const fadeUp = (delay: number) => (reduceMotion ? FadeIn.duration(200) : FadeInDown.delay(delay).duration(360).easing(EASE));
  const listEnd = T.list + COMPARE_ROWS.filter((row) => row.free !== row.pro).length * T.rowStagger;

  return (
    <Animated.View
      entering={FadeIn.duration(200)}
      exiting={FadeOut.duration(200)}
      style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: colors.white }}
    >
      <View style={{ flex: 1, paddingTop: insets.top, paddingBottom: insets.bottom }}>
        <ScrollView contentContainerClassName="px-6 pb-6" showsVerticalScrollIndicator={false} scrollEnabled={unlocked}>
          {/* The lock sits in the same place in both phases: only what's
              under it changes. */}
          <View className="items-center pt-16">
            <Padlock open={unlocked} reduceMotion={reduceMotion} />
          </View>

          {!unlocked && (
            // One caption at a time, crossfading in place; fixed height so
            // nothing shifts.
            <View className="mt-8 h-6 items-center justify-center" accessibilityLiveRegion="polite">
              <Animated.View
                key={step}
                entering={FadeIn.duration(reduceMotion ? 150 : 260)}
                exiting={reduceMotion ? FadeOut.duration(120) : FadeOutUp.duration(200)}
              >
                <Text className="text-center font-inter-medium text-body text-ink-subtle">{CONFIRM_CAPTION[step]}</Text>
              </Animated.View>
            </View>
          )}

          {unlocked && (
            <>
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

              {/* The Pro page's table, Pro column only: what's yours now,
                  each row rising in turn. */}
              <Animated.View entering={fadeUp(T.list - 100)}>
                <View className="mt-8">
                  <CompareTable title="Now included" proOnly rowEntering={(i) => fadeUp(T.list + i * T.rowStagger)} />
                </View>
              </Animated.View>
            </>
          )}
        </ScrollView>

        {unlocked && (
          <Animated.View entering={fadeUp(listEnd)}>
            <View className="border-t border-ink-emphasis/10 px-6 pb-2 pt-3">
              <Button label="Start exploring" onPress={onDone} />
              <Text className="mt-2 text-center font-inter-regular text-sub text-ink-subtle">Manage or cancel anytime in Settings.</Text>
            </View>
          </Animated.View>
        )}
      </View>
    </Animated.View>
  );
}
