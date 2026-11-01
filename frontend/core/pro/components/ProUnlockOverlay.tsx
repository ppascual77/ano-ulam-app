import { useEffect, useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import Animated, {
  Easing,
  FadeIn,
  FadeInDown,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSequence,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import { LinearGradient } from "expo-linear-gradient";
import * as Haptics from "expo-haptics";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ArrowRight, Check, Lock } from "lucide-react-native";
import { Button, Confetti } from "@/frontend/components/ui";
import { colors } from "@/frontend/constants/theme";
import { useReduceMotion } from "@/frontend/core/preferences/store/useReduceMotionStore";
import { useProSubscription } from "../store/useProStore";
import { formatPlanDate, planName } from "../subscriptionCopy";
import { TRIAL_DAYS } from "../proContent";
import { UNLOCKED_FEATURES, type UnlockedFeature } from "./unlockedFeatures";

type ProUnlockOverlayProps = {
  /** Done: "Start exploring", or a feature's try-it link (its route). */
  onDone: (route?: string) => void;
  /** Off where navigating would happen under a sheet (inside Meal Details). */
  allowLinks?: boolean;
};

// Animated.Views take plain styles only (classes go on a plain View inside):
// NativeWind can drop classes on them, or knock out the animated values.
//
// The timeline, in ms from the overlay appearing. One beat at a time: the
// lock lands, hesitates (a jiggle), springs open with a glow and confetti,
// settles smaller, then the headline and the unlocked features cascade in.
const T = {
  lockIn: 120,
  jiggle: 620,
  open: 980,
  settle: 1380,
  headline: 1450,
  list: 1750,
  rowStagger: 70,
  // A row's lock turns into a check this long after the row lands.
  rowCheck: 260,
};

const SPRING = { damping: 14, stiffness: 180, mass: 0.8 };
const POP = { damping: 9, stiffness: 240, mass: 0.6 };

// The padlock, drawn with Views: an orange body with a keyhole and a white
// shackle that lifts and swings open on its right leg.
function Padlock({ reduceMotion, onOpen }: { reduceMotion: boolean; onOpen: () => void }) {
  const enter = useSharedValue(reduceMotion ? 1 : 0);
  const jiggle = useSharedValue(0);
  const lift = useSharedValue(reduceMotion ? 1 : 0);
  const swing = useSharedValue(reduceMotion ? 1 : 0);
  const settle = useSharedValue(reduceMotion ? 1 : 0);
  const glow = useSharedValue(0);

  useEffect(() => {
    if (reduceMotion) return;
    enter.value = withDelay(T.lockIn, withSpring(1, SPRING));
    jiggle.value = withDelay(
      T.jiggle,
      withSequence(
        withTiming(-1, { duration: 70 }),
        withTiming(1, { duration: 80 }),
        withTiming(-0.6, { duration: 70 }),
        withTiming(0, { duration: 80 }),
      ),
    );
    lift.value = withDelay(T.open, withTiming(1, { duration: 180, easing: Easing.out(Easing.cubic) }));
    swing.value = withDelay(T.open + 120, withSpring(1, POP));
    glow.value = withDelay(T.open + 60, withTiming(1, { duration: 700, easing: Easing.out(Easing.quad) }));
    settle.value = withDelay(T.settle, withSpring(1, SPRING));
    const timer = setTimeout(onOpen, T.open + 80);
    return () => clearTimeout(timer);
    // Runs once, on mount.
  }, []);

  const lockStyle = useAnimatedStyle(() => ({
    opacity: enter.value,
    transform: [
      { scale: (0.6 + 0.4 * enter.value) * (1 - 0.18 * settle.value) },
      { translateY: -10 * settle.value },
      { rotate: `${jiggle.value * 6}deg` },
    ],
  }));
  const shackleStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: -12 * lift.value }, { rotate: `${-32 * swing.value}deg` }],
  }));
  const glowStyle = useAnimatedStyle(() => ({
    opacity: 0.45 * (1 - glow.value),
    transform: [{ scale: 0.8 + 1.6 * glow.value }],
  }));

  return (
    <View className="h-44 w-44 items-center justify-center">
      <Animated.View pointerEvents="none" style={[{ position: "absolute", width: 144, height: 144 }, glowStyle]}>
        <View className="flex-1 rounded-full border-2 border-white" />
      </Animated.View>
      <Animated.View style={[{ width: 96, height: 112 }, lockStyle]}>
        {/* Shackle first, so the body covers its legs until it lifts. */}
        <Animated.View
          style={[
            {
              position: "absolute",
              left: 20,
              top: 0,
              width: 56,
              height: 64,
              borderWidth: 9,
              borderBottomWidth: 0,
              borderColor: colors.white,
              borderTopLeftRadius: 28,
              borderTopRightRadius: 28,
              transformOrigin: "100% 100%",
            },
            shackleStyle,
          ]}
        />
        <View className="absolute bottom-0 h-16 w-24 items-center justify-center rounded-2xl bg-brand-orange">
          <View className="h-4 w-4 rounded-full bg-brand-green-dark" />
          <View className="-mt-1 h-4 w-1.5 rounded-full bg-brand-green-dark" />
        </View>
      </Animated.View>
    </View>
  );
}

// One unlocked feature: lands in its turn, then its lock becomes a check.
function FeatureRow({
  feature,
  index,
  reduceMotion,
  onTry,
}: {
  feature: UnlockedFeature;
  index: number;
  reduceMotion: boolean;
  onTry?: () => void;
}) {
  const landAt = T.list + index * T.rowStagger;
  const checked = useSharedValue(reduceMotion ? 1 : 0);
  useEffect(() => {
    if (!reduceMotion) checked.value = withDelay(landAt + T.rowCheck, withSpring(1, POP));
    // Runs once, on mount.
  }, []);
  const lockStyle = useAnimatedStyle(() => ({ opacity: 1 - checked.value, transform: [{ scale: 1 - 0.4 * checked.value }] }));
  const checkStyle = useAnimatedStyle(() => ({ opacity: checked.value, transform: [{ scale: 0.4 + 0.6 * checked.value }] }));

  const Icon = feature.Icon;
  return (
    <Animated.View entering={reduceMotion ? FadeIn.duration(200) : FadeInDown.delay(landAt).duration(380).springify().damping(16)}>
      <Pressable
        onPress={onTry}
        disabled={!onTry}
        className="flex-row items-center gap-3 rounded-2xl bg-white/10 p-3 active:bg-white/15"
      >
        <View className="h-10 w-10 items-center justify-center rounded-xl bg-white/10">
          <Icon color={colors.white} size={20} />
        </View>
        <View className="flex-1">
          <Text className="font-inter-semibold text-body text-white">{feature.title}</Text>
          <Text className="font-inter-regular text-small text-white/70">{feature.detail}</Text>
          {onTry && feature.cta && (
            <View className="mt-1 flex-row items-center gap-1">
              <Text className="font-inter-semibold text-small text-brand-orange">{feature.cta}</Text>
              <ArrowRight color={colors.brandOrange} size={12} />
            </View>
          )}
        </View>
        <View className="h-7 w-7 items-center justify-center">
          <Animated.View style={[{ position: "absolute" }, lockStyle]}>
            <Lock color={colors.white} size={16} />
          </Animated.View>
          <Animated.View style={[{ position: "absolute", width: 28, height: 28 }, checkStyle]}>
            <View className="flex-1 items-center justify-center rounded-full bg-brand-orange">
              <Check color={colors.white} size={14} strokeWidth={3} />
            </View>
          </Animated.View>
        </View>
      </Pressable>
    </Animated.View>
  );
}

// Full-screen "You're Pro." moment after the (mock) trial starts: the lock
// opening, then everything Pro now does for you, each with a way to try it.
// Covers the Pro page it's rendered in (including under the status bar).
export function ProUnlockOverlay({ onDone, allowLinks = true }: ProUnlockOverlayProps) {
  const insets = useSafeAreaInsets();
  const reduceMotion = useReduceMotion();
  const subscription = useProSubscription();
  const [burst, setBurst] = useState(0);

  const unlock = () => {
    setBurst((n) => n + 1);
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  };
  // Without the lock choreography, still a haptic to mark the moment.
  useEffect(() => {
    if (reduceMotion) void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  }, [reduceMotion]);

  const firstCharge = subscription?.trialEndsAt ? formatPlanDate(subscription.trialEndsAt) : null;
  const textEnter = reduceMotion ? FadeIn.duration(200) : FadeInDown.delay(T.headline).duration(420);
  const subEnter = reduceMotion ? FadeIn.duration(200) : FadeInDown.delay(T.headline + 120).duration(420);
  const listEnd = T.list + UNLOCKED_FEATURES.length * T.rowStagger;

  return (
    <Animated.View entering={FadeIn.duration(220)} style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }}>
      <LinearGradient
        colors={[colors.brandGreen.dark, colors.brandGreen.DEFAULT]}
        start={{ x: 0, y: 0 }}
        end={{ x: 0.4, y: 1 }}
        style={{ flex: 1, paddingTop: insets.top, paddingBottom: insets.bottom }}
      >
        <ScrollView contentContainerClassName="px-6 pb-6" showsVerticalScrollIndicator={false}>
          <View className="items-center pt-6">
            <Padlock reduceMotion={reduceMotion} onOpen={unlock} />
            <View pointerEvents="none" className="absolute" style={{ top: 112, left: "50%" }}>
              <Confetti burstId={burst} direction="up" />
            </View>
          </View>

          <Animated.View entering={textEnter}>
            <View className="-mt-3 flex-row items-end justify-center">
              <Text className="font-inter-extrabold text-heading-lg tracking-display text-white">You&apos;re Pro</Text>
              <View className="mb-2 ml-1 h-2.5 w-2.5 rounded-full bg-brand-orange" />
            </View>
          </Animated.View>
          <Animated.View entering={subEnter}>
            <Text className="mt-2 px-4 text-center font-inter-regular text-body text-white/80">
              {subscription ? `${planName(subscription.plan)} is on. ` : ""}
              {firstCharge
                ? `Your ${TRIAL_DAYS}-day free trial runs until ${firstCharge}.`
                : "Everything below is yours now."}
            </Text>
          </Animated.View>

          <Animated.View entering={reduceMotion ? FadeIn.duration(200) : FadeIn.delay(T.list - 120).duration(300)}>
            <Text className="mb-3 mt-8 font-inter-bold text-small uppercase text-white/60">Unlocked for you</Text>
          </Animated.View>
          <View className="gap-2">
            {UNLOCKED_FEATURES.map((feature, i) => (
              <FeatureRow
                key={feature.key}
                feature={feature}
                index={i}
                reduceMotion={reduceMotion}
                onTry={allowLinks && feature.route ? () => onDone(feature.route) : undefined}
              />
            ))}
          </View>
        </ScrollView>

        <Animated.View entering={reduceMotion ? FadeIn.duration(200) : FadeInDown.delay(listEnd).duration(380)}>
          <View className="px-6 pb-2 pt-3">
            <Button label="Start exploring" variant="social" onPress={() => onDone()} />
            <Text className="mt-2 text-center font-inter-regular text-sub text-white/60">
              Manage or cancel anytime in Settings.
            </Text>
          </View>
        </Animated.View>
      </LinearGradient>
    </Animated.View>
  );
}
