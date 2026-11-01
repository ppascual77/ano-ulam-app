import { useEffect } from "react";
import { Pressable, Text, View } from "react-native";
import Animated, { Easing, FadeIn, LinearTransition, useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";
import { ChevronRight } from "lucide-react-native";
import { colors } from "@/frontend/constants/theme";
import { ProBadge } from "@/frontend/core/pro/components/ProBadge";
import type { ProSubscription } from "@/frontend/core/pro/store/useProStore";
import { TRIAL_DAYS } from "@/frontend/core/pro/proContent";
import { STATUS_LABEL, daysUntil, nextLine, planName } from "@/frontend/core/pro/subscriptionCopy";

const STATUS_CHIP: Record<ProSubscription["status"], { bg: string; text: string }> = {
  trial: { bg: "bg-accent/10", text: "text-accent" },
  active: { bg: "bg-primary/10", text: "text-primary" },
  cancelled: { bg: "bg-ink-emphasis/10", text: "text-ink-subtle" },
};

const DAY_MS = 24 * 60 * 60 * 1000;

// The time left on a trial (or, cancelled, of Pro), as a share of the
// whole, 0..1: the bar drains as the days go, matching its "N days left"
// caption. Active plans have no bar.
function progressOf(sub: ProSubscription): { value: number; caption: string } | null {
  const left = daysUntil(sub.renewsAt);
  const leftText = `${left} ${left === 1 ? "day" : "days"} left`;
  if (sub.status === "trial" && sub.trialEndsAt) {
    return { value: (new Date(sub.trialEndsAt).getTime() - Date.now()) / (TRIAL_DAYS * DAY_MS), caption: `${leftText} in your free trial` };
  }
  if (sub.status === "cancelled") {
    const total = new Date(sub.renewsAt).getTime() - new Date(sub.startedAt).getTime();
    return { value: (new Date(sub.renewsAt).getTime() - Date.now()) / Math.max(total, DAY_MS), caption: `${leftText} of Pro` };
  }
  return null;
}

// Settings > Pro's "your plan" card: plan, status, what happens next and (on
// a trial or a cancelled plan) how much time is left. Tap to manage.
export function ProPlanCard({ subscription, onPress }: { subscription: ProSubscription; onPress: () => void }) {
  const chip = STATUS_CHIP[subscription.status];
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
        accessibilityLabel={`${planName(subscription.plan)}, ${STATUS_LABEL[subscription.status]}. ${nextLine(subscription)}. Manage your plan`}
        className="gap-3 rounded-2xl border border-accent/20 bg-accent/5 p-4 active:opacity-80"
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
