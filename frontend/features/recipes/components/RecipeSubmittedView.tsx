import { useEffect, useState } from "react";
import { Text, View } from "react-native";
import Animated, { Easing, FadeIn, FadeInDown, useAnimatedStyle, useSharedValue, withDelay, withRepeat, withSequence, withTiming } from "react-native-reanimated";
import { Bell, Check, Gift } from "lucide-react-native";
import { AppText, Button, Medallion } from "@/frontend/components/ui";
import { colors } from "@/frontend/constants/theme";
import { useReduceMotion } from "@/frontend/core/preferences/store/useReduceMotionStore";
import { usePaysForPro } from "@/frontend/core/pro/store/useProStore";
import { useProRewardProgress } from "@/frontend/core/pro/hooks/useProRewardProgress";
import { RECIPE_REWARD_DAYS } from "@/frontend/core/pro/proContent";
import { enablePush } from "@/frontend/core/notifications/push";
import { usePushPermission } from "@/frontend/core/notifications/hooks/usePushPermission";
import { useAccountSettings, useAccountSettingsActions } from "@/frontend/features/profile/hooks/useProfile";

const EASE = Easing.out(Easing.cubic);
// The timeline, in ms from the screen appearing: the medallion, the words,
// the track filling to "In review", the reward pill, then the button.
const T = { pop: 100, title: 380, track: 560, fill: 700, pill: 880, button: 1000 };

// The "In review" dot: breathes slowly while the recipe waits.
function CurrentDot({ reduceMotion }: { reduceMotion: boolean }) {
  const breathe = useSharedValue(0);
  useEffect(() => {
    if (reduceMotion) return;
    breathe.value = withDelay(T.fill + 500, withRepeat(withSequence(withTiming(1, { duration: 900 }), withTiming(0, { duration: 900 })), -1));
  }, [reduceMotion]);
  const haloStyle = useAnimatedStyle(() => ({ opacity: 0.2 + 0.3 * breathe.value, transform: [{ scale: 1 + 0.6 * breathe.value }] }));
  return (
    <View className="h-5 w-5 items-center justify-center">
      <Animated.View style={[{ position: "absolute", width: 20, height: 20, borderRadius: 10, backgroundColor: colors.primary }, haloStyle]} />
      <View className="h-3 w-3 rounded-full bg-primary" />
    </View>
  );
}

// Submitted ━━ In review ── Live: three markers on one line, the first
// segment filling in green as the screen appears.
function ReviewTrack({ reduceMotion }: { reduceMotion: boolean }) {
  const fill = useSharedValue(reduceMotion ? 1 : 0);
  useEffect(() => {
    if (!reduceMotion) fill.value = withDelay(T.fill, withTiming(1, { duration: 420, easing: EASE }));
    // Once, as the screen appears.
  }, []);
  const fillStyle = useAnimatedStyle(() => ({ width: `${fill.value * 100}%` }));
  const label = "mt-2 font-inter-semibold text-sub";

  return (
    <Animated.View entering={reduceMotion ? FadeIn.duration(200) : FadeInDown.delay(T.track).duration(320).easing(EASE)}>
      <View className="flex-row items-center px-6">
        <View className="h-5 w-5 items-center justify-center rounded-full bg-primary">
          <Check color={colors.white} size={12} strokeWidth={3} />
        </View>
        <View className="mx-1 h-0.5 flex-1 overflow-hidden rounded-full bg-ink-emphasis/10">
          <Animated.View style={[{ height: "100%", backgroundColor: colors.primary }, fillStyle]} />
        </View>
        <CurrentDot reduceMotion={reduceMotion} />
        <View className="mx-1 h-0.5 flex-1 rounded-full bg-ink-emphasis/10" />
        <View className="h-5 w-5 rounded-full border-2 border-ink-emphasis/15" />
      </View>
      <View className="flex-row justify-between">
        <Text className={`${label} w-20 text-left text-ink-subtle`}>Submitted</Text>
        <Text className={`${label} w-20 text-center text-primary`}>In review</Text>
        <Text className={`${label} w-20 text-right text-ink-subtle`}>Live</Text>
      </View>
    </Animated.View>
  );
}

// After submitting a recipe: a green check medallion pops in, "Your recipe
// is in review" and one line on what happens, a three-step track filling to
// "In review" (its dot breathing while it waits), and, while the
// first-recipe reward is open (not subscribed), one accent pill: approval
// earns 7 days of Pro (celebrated by RewardCelebration the next time the
// app opens after approval). Then the notification ask, the moment the
// reason is obvious: "Notify me when it's live" (iOS's prompt, once); once
// allowed, a line saying we will. Reduce motion: fades only.
export function RecipeSubmittedView({ recipeName, onDone }: { recipeName: string; onDone: () => void }) {
  const reduceMotion = useReduceMotion();
  const subscribed = usePaysForPro();
  const { data: progress } = useProRewardProgress();
  const rewardOpen = !subscribed && !!progress && progress.approvedRecipes === 0;
  // Not asked again once refused, or with Recipe updates off in Settings.
  const push = usePushPermission();
  const recipeUpdates = useAccountSettings().data?.push_recipe_updates ?? true;
  const settingsActions = useAccountSettingsActions();
  const [asking, setAsking] = useState(false);
  const notifyMe = async () => {
    setAsking(true);
    const allowed = await enablePush().catch(() => false);
    if (allowed && !recipeUpdates) settingsActions.setRecipeUpdates(true);
    push.refresh();
    setAsking(false);
  };
  const willNotify = push.permission === "granted" && recipeUpdates;
  const canAsk = push.permission === "undetermined";
  const fadeUp = (delay: number) => (reduceMotion ? FadeIn.duration(200) : FadeInDown.delay(delay).duration(320).easing(EASE));

  return (
    <View className="flex-1 justify-center px-8">
      <View className="items-center">
        <Medallion Icon={Check} tone="primary" delay={T.pop} reduceMotion={reduceMotion} />
      </View>

      <Animated.View entering={fadeUp(T.title)}>
        <View className="mt-6 items-center">
          <AppText variant="sectionTitle" dot className="text-center">
            Your recipe is in review
          </AppText>
          <Text className="mt-2 text-center font-inter-regular text-body text-ink-subtle">
            Thanks for sharing {recipeName || "your recipe"}. We&apos;ll check the ingredients and prices, then it goes live.
          </Text>
        </View>
      </Animated.View>

      <View className="mt-9">
        <ReviewTrack reduceMotion={reduceMotion} />
      </View>

      {rewardOpen && (
        <Animated.View entering={fadeUp(T.pill)}>
          <View className="mt-8 flex-row items-center gap-2 self-center rounded-full bg-accent/10 px-4 py-2">
            <Gift color={colors.accent} size={14} strokeWidth={2.5} />
            <Text className="font-inter-semibold text-small text-accent">Approval earns you {RECIPE_REWARD_DAYS} days of Pro</Text>
          </View>
        </Animated.View>
      )}

      <Animated.View entering={fadeUp(T.button)}>
        <View className="mt-9">
          {canAsk && (
            <Button
              variant="outline"
              label={asking ? "One moment…" : "Notify me when it's live"}
              onPress={() => void notifyMe()}
              disabled={asking}
              style={{ marginBottom: 12 }}
            />
          )}
          {willNotify && (
            <View className="mb-4 flex-row items-center justify-center gap-1.5">
              <Bell color={colors.primary} size={14} strokeWidth={2.5} />
              <Text className="font-inter-semibold text-small text-primary">We&apos;ll notify you when it&apos;s live</Text>
            </View>
          )}
          <Button label="Done" onPress={onDone} />
          <Text className="mt-3 text-center font-inter-regular text-small text-ink-subtle">Find it anytime under Created in your Profile.</Text>
        </View>
      </Animated.View>
    </View>
  );
}
