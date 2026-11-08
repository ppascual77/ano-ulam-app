import { useEffect } from "react";
import { Pressable, Text, View } from "react-native";
import Animated, { Easing, FadeIn, LinearTransition, useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";
import { ChevronRight } from "lucide-react-native";
import { colors } from "@/frontend/constants/theme";
import { ProBadge } from "@/frontend/core/pro/components/ProBadge";
import type { ProSubscription } from "@/frontend/core/pro/store/useProStore";
import { STATUS_LABEL, formatPlanDate, nextLine, planName, timeLeft } from "@/frontend/core/pro/subscriptionCopy";

export const STATUS_CHIP: Record<ProSubscription["status"], { bg: string; text: string }> = {
  trial: { bg: "bg-accent/10", text: "text-accent" },
  active: { bg: "bg-primary/10", text: "text-primary" },
  cancelled: { bg: "bg-ink-emphasis/10", text: "text-ink-subtle" },
  expired: { bg: "bg-ink-emphasis/10", text: "text-ink-subtle" },
};


// The time left on a trial (or, cancelled, of Pro), as a share of the
// whole, 0..1: the bar drains as the days go, matching its "N days left"
// caption. Active plans have no bar.
function progressOf(sub: ProSubscription): { value: number; caption: string } | null {
  const leftText = `${timeLeft(sub.renewsAt)} left`;
  if (sub.status === "trial" && sub.trialEndsAt) {
    // Against the trial's real length (start to end), not TRIAL_DAYS:
    // sandbox trials last minutes.
    const total = new Date(sub.trialEndsAt).getTime() - new Date(sub.startedAt).getTime();
    return { value: (new Date(sub.trialEndsAt).getTime() - Date.now()) / Math.max(total, 60_000), caption: `${leftText} in your free trial` };
  }
  if (sub.status === "cancelled") {
    const total = new Date(sub.renewsAt).getTime() - new Date(sub.startedAt).getTime();
    return { value: (new Date(sub.renewsAt).getTime() - Date.now()) / Math.max(total, 60_000), caption: `${leftText} of Pro` };
  }
  return null;
}

// Settings > Pro's "your plan" card: plan, status, what happens next and (on
// a trial or a cancelled plan) how much time is left. Tap to manage; an
// expired plan (Pro ended recently) taps through to renew instead.
export function ProPlanCard({ subscription, onPress }: { subscription: ProSubscription; onPress: () => void }) {
  const chip = STATUS_CHIP[subscription.status];
  const expired = subscription.status === "expired";
  const progress = progressOf(subscription);
  const fill = useSharedValue(0);
  useEffect(() => {
    fill.value = withTiming(Math.min(1, Math.max(0.04, progress?.value ?? 0)), { duration: 700, easing: Easing.out(Easing.cubic) });
  }, [progress?.value, fill]);
  const fillStyle = useAnimatedStyle(() => ({ width: `${fill.value * 100}%` }));

  return (
    <Animated.View entering={FadeIn.duration(260)} layout={LinearTransition.duration(220)}>
      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={`${planName(subscription.plan)}, ${STATUS_LABEL[subscription.status]}. ${nextLine(subscription)}. ${expired ? "Renew Pro" : "Manage your plan"}`}
        // Expired: quiet grey instead of Pro's orange (it's not Pro now).
        className={`gap-3 rounded-2xl border p-4 active:opacity-80 ${expired ? "border-ink-emphasis/10 bg-ink-emphasis/5" : "border-accent/20 bg-accent/5"}`}
      >
        <View className="flex-row items-center gap-2">
          <ProBadge />
          <Text className="flex-1 font-inter-bold text-subheading text-ink-emphasis">{planName(subscription.plan)}</Text>
          <View className={`rounded-full px-2 py-1 ${chip.bg}`}>
            <Text className={`font-inter-bold text-sub ${chip.text}`}>{STATUS_LABEL[subscription.status].toUpperCase()}</Text>
          </View>
          <ChevronRight color={colors.ink.subtle} size={18} />
        </View>
        <Text className="font-inter-regular text-small text-ink-subtle">{nextLine(subscription)}</Text>
        {progress && (
          <View className="gap-1.5">
            <View className="h-1.5 overflow-hidden rounded-full bg-ink-emphasis/10">
              <Animated.View style={[{ height: "100%" }, fillStyle]}>
                <View className={`flex-1 rounded-full ${subscription.status === "cancelled" ? "bg-ink-subtle" : "bg-accent"}`} />
              </Animated.View>
            </View>
            <Text className="font-inter-medium text-sub text-ink-subtle">{progress.caption}</Text>
          </View>
        )}
      </Pressable>
    </Animated.View>
  );
}

// Settings > Pro while earned Pro is running with no subscription (Pro
// rewards: a first approved recipe, a first photo post). Same shape as the
// plan card, an EARNED chip; tap to see Pro (and subscribe to keep it).
export function EarnedProCard({ until, onPress }: { until: string; onPress: () => void }) {
  return (
    <Animated.View entering={FadeIn.duration(260)} layout={LinearTransition.duration(220)}>
      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={`Pro, earned. Pro until ${formatPlanDate(until)}, ${timeLeft(until)} left. See Pro`}
        className="gap-3 rounded-2xl border border-accent/20 bg-accent/5 p-4 active:opacity-80"
      >
        <View className="flex-row items-center gap-2">
          <ProBadge />
          <Text className="flex-1 font-inter-bold text-subheading text-ink-emphasis">Earned Pro</Text>
          <View className="rounded-full bg-accent/10 px-2 py-1">
            <Text className="font-inter-bold text-sub text-accent">EARNED</Text>
          </View>
          <ChevronRight color={colors.ink.subtle} size={18} />
        </View>
        <Text className="font-inter-regular text-small text-ink-subtle">
          Pro until {formatPlanDate(until)}, earned by sharing with the community. {timeLeft(until)} left.
        </Text>
      </Pressable>
    </Animated.View>
  );
}
