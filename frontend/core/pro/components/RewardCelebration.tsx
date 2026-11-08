import { useEffect, useRef, useState } from "react";
import { AppState, Modal, Text, View } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import Animated, { Easing, FadeIn, FadeInDown, FadeOut, useAnimatedStyle, useSharedValue, withDelay, withSequence, withSpring, withTiming } from "react-native-reanimated";
import { LinearGradient } from "expo-linear-gradient";
import * as Haptics from "expo-haptics";
import { useQueryClient } from "@tanstack/react-query";
import { CalendarDays, Gift, Sparkle } from "lucide-react-native";
import { Button, Confetti, Medallion } from "@/frontend/components/ui";
import { colors } from "@/frontend/constants/theme";
import type { ProReward } from "@/api/proRewards";
import { useReduceMotion } from "@/frontend/core/preferences/store/useReduceMotionStore";
import { useAuth } from "@/frontend/features/auth/hooks/useAuth";
import { useAuthActivityStore } from "@/frontend/features/auth/store/useAuthActivityStore";
import { useProRewards } from "../hooks/useProRewardProgress";
import { proKeys } from "../queryKeys";
import { useProStore } from "../store/useProStore";

// Rewards already celebrated, per account, on the phone (a reward is shown
// once; on another phone it'd show once there too, which is fine).
const storageKey = (userId: string) => `anoulam.celebratedRewards.${userId}`;
const readCelebrated = async (userId: string): Promise<Set<string>> => {
  try {
    return new Set(JSON.parse((await AsyncStorage.getItem(storageKey(userId))) ?? "[]") as string[]);
  } catch {
    return new Set();
  }
};

// Lets a sheet that's closing (the post composer) slide away first.
const SHOW_DELAY_MS = 700;
const EASE = Easing.out(Easing.cubic);
// The timeline, in ms from the card appearing: the medallion pops, the
// number counts up, then the words and the button.
const T = { pop: 140, count: 420, countMs: 560, text: 620, button: 820 };

const LINE: Record<ProReward["kind"], string> = {
  photo_post: "Thanks for your first photo post.",
  recipe: "Your recipe was approved. It's live for everyone.",
};

const monthDay = (iso: string) => new Date(iso).toLocaleDateString("en-PH", { month: "short", day: "numeric" });

// The number ticking up to the reward's days.
function CountUp({ to, start, duration, reduceMotion }: { to: number; start: number; duration: number; reduceMotion: boolean }) {
  const [value, setValue] = useState(reduceMotion ? to : 0);
  useEffect(() => {
    if (reduceMotion) return;
    let timer: ReturnType<typeof setInterval> | null = null;
    const begin = setTimeout(() => {
      const startedAt = Date.now();
      timer = setInterval(() => {
        const t = Math.min(1, (Date.now() - startedAt) / duration);
        // Ease out: quick at first, settling on the number.
        setValue(Math.round(to * (1 - (1 - t) ** 3)));
        if (t === 1 && timer) clearInterval(timer);
      }, 40);
    }, start);
    return () => {
      clearTimeout(begin);
      if (timer) clearInterval(timer);
    };
  }, [to, start, duration, reduceMotion]);
  return <Text className="font-inter-extrabold text-subhero tracking-display text-accent">+{value}</Text>;
}

// A sparkle near the medallion: twinkles in (scale up past full, settle),
// in turn with the others.
function Twinkle({ x, y, size, delay, reduceMotion }: { x: number; y: number; size: number; delay: number; reduceMotion: boolean }) {
  const shown = useSharedValue(reduceMotion ? 1 : 0);
  useEffect(() => {
    if (reduceMotion) return;
    shown.value = withDelay(delay, withSequence(withTiming(1.3, { duration: 220, easing: EASE }), withTiming(1, { duration: 180 })));
    // Once, as the card appears.
  }, []);
  const style = useAnimatedStyle(() => ({ opacity: Math.min(1, shown.value), transform: [{ scale: shown.value }, { rotate: `${20 * shown.value}deg` }] }));
  return (
    <Animated.View pointerEvents="none" style={[{ position: "absolute", left: x, top: y }, style]}>
      <Sparkle color={colors.accent} fill={colors.accent} size={size} />
    </Animated.View>
  );
}

// Around the medallion (its box is STAGE_SIZE square, centered).
const STAGE_SIZE = 150;
const MEDALLION = 88;
const TWINKLES = [
  { x: 12, y: 30, size: 14, delay: T.pop + 260 },
  { x: 120, y: 18, size: 11, delay: T.pop + 340 },
  { x: 128, y: 104, size: 15, delay: T.pop + 420 },
  { x: 20, y: 112, size: 10, delay: T.pop + 500 },
];
// The stage's warm glow: accent fading into the white card.
const STAGE_GLOW = [`${colors.accent}2E`, `${colors.accent}00`] as const;

function CelebrationCard({ reward, earnedUntil, onDone }: { reward: ProReward; earnedUntil: string | null; onDone: () => void }) {
  const reduceMotion = useReduceMotion();
  const card = useSharedValue(reduceMotion ? 1 : 0);
  const [burstId, setBurstId] = useState(0);
  useEffect(() => {
    if (!reduceMotion) card.value = withSpring(1, { damping: 16, stiffness: 200, mass: 0.8 });
    // The haptic and the confetti land with the medallion's pop.
    const pop = setTimeout(
      () => {
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        if (!reduceMotion) setBurstId(1);
      },
      reduceMotion ? 0 : T.pop + 60,
    );
    return () => clearTimeout(pop);
    // Once, as it appears.
  }, []);
  const cardStyle = useAnimatedStyle(() => ({ opacity: Math.min(1, card.value * 1.4), transform: [{ scale: 0.92 + 0.08 * card.value }] }));
  const fadeUp = (delay: number) => (reduceMotion ? FadeIn.duration(200) : FadeInDown.delay(delay).duration(320).easing(EASE));

  return (
    <Animated.View style={[{ width: "100%", maxWidth: 340 }, cardStyle]}>
      <View className="overflow-hidden rounded-3xl bg-white" accessibilityLiveRegion="polite">
        {/* The stage: a warm glow, the medallion, sparkles and confetti. */}
        <LinearGradient colors={STAGE_GLOW} style={{ alignItems: "center", paddingTop: 20 }}>
          <View style={{ width: STAGE_SIZE, height: STAGE_SIZE, alignItems: "center", justifyContent: "center" }}>
            <Medallion Icon={Gift} tone="accent" size={MEDALLION} delay={T.pop} reduceMotion={reduceMotion} />
            {TWINKLES.map((t) => (
              <Twinkle key={`${t.x}-${t.y}`} {...t} reduceMotion={reduceMotion} />
            ))}
            <View pointerEvents="none" style={{ position: "absolute", left: STAGE_SIZE / 2, top: STAGE_SIZE / 2 - MEDALLION / 2 }}>
              <Confetti burstId={burstId} direction="up" />
            </View>
          </View>
        </LinearGradient>

        <View className="items-center px-6 pb-6">
          <Text className="font-inter-bold text-sub uppercase tracking-wide text-ink-subtle">You earned</Text>
          <CountUp to={reward.days} start={T.count} duration={T.countMs} reduceMotion={reduceMotion} />
          <Text className="-mt-1 font-inter-bold text-heading text-ink-emphasis">days of Pro</Text>

          <Animated.View entering={fadeUp(T.text)} style={{ alignItems: "center" }}>
            <Text className="mt-3 text-center font-inter-regular text-body text-ink-subtle">{LINE[reward.kind]}</Text>
            {earnedUntil && (
              <View className="mt-4 flex-row items-center gap-1.5 rounded-full bg-ink-emphasis/5 px-3 py-1.5">
                <CalendarDays color={colors.ink.subtle} size={13} />
                <Text className="font-inter-semibold text-small text-ink-emphasis">Pro until {monthDay(earnedUntil)}</Text>
              </View>
            )}
          </Animated.View>

          <Animated.View entering={fadeUp(T.button)} style={{ alignSelf: "stretch" }}>
            <View className="mt-6">
              <Button label="Start exploring" variant="secondary" onPress={onDone} />
            </View>
          </Animated.View>
        </View>
      </View>
    </Animated.View>
  );
}

// The moment a Pro reward lands (a first photo post, a first approved
// recipe): a dimmed screen and a card with the gift medallion popping in,
// "+7" counting up, "days of Pro", a line for what earned it and until when.
// Each reward is celebrated once. Rewards are noticed whenever the rewards
// list reloads: after posting (useSavePost), on sign-in, and every time the
// app comes back to the foreground (so a recipe approved meanwhile shows on
// the next open). Mounted once in app/_layout.tsx.
export function RewardCelebration() {
  const queryClient = useQueryClient();
  const userId = useAuth().session?.user.id ?? null;
  const { data: rewards } = useProRewards();
  const earnedUntil = useProStore((s) => s.earnedUntil);
  const busy = useAuthActivityStore((s) => s.activity !== null);
  const [celebrated, setCelebrated] = useState<Set<string> | null>(null);
  const [showing, setShowing] = useState<ProReward | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // This account's celebrated rewards.
  useEffect(() => {
    setCelebrated(null);
    if (userId) void readCelebrated(userId).then(setCelebrated);
  }, [userId]);

  // Back in the foreground: look for rewards granted meanwhile.
  useEffect(() => {
    const sub = AppState.addEventListener("change", (state) => {
      if (state !== "active") return;
      void queryClient.invalidateQueries({ queryKey: proKeys.all });
      useProStore.getState().refresh();
    });
    return () => sub.remove();
  }, [queryClient]);

  const next = rewards?.find((reward) => celebrated && !celebrated.has(reward.id)) ?? null;
  useEffect(() => {
    if (!next || showing || busy) return;
    timer.current = setTimeout(() => {
      // Pro's end date includes this reward by now.
      useProStore.getState().refresh();
      setShowing(next);
    }, SHOW_DELAY_MS);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [next?.id, showing, busy]);

  const done = () => {
    if (!showing || !userId || !celebrated) return;
    const nextSet = new Set(celebrated).add(showing.id);
    setCelebrated(nextSet);
    void AsyncStorage.setItem(storageKey(userId), JSON.stringify([...nextSet])).catch(() => {});
    setShowing(null);
  };

  return (
    <Modal visible={!!showing} transparent animationType="none" statusBarTranslucent onRequestClose={done}>
      {showing && (
        <Animated.View entering={FadeIn.duration(220)} exiting={FadeOut.duration(180)} className="flex-1 items-center justify-center bg-ink-emphasis/40 px-8">
          <CelebrationCard reward={showing} earnedUntil={earnedUntil} onDone={done} />
        </Animated.View>
      )}
    </Modal>
  );
}
