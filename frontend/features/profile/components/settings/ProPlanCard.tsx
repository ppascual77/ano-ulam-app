import { useEffect } from "react";
import { Pressable, Text, View } from "react-native";
import Animated, { Easing, FadeIn, LinearTransition, useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";
import { Check, ChevronRight } from "lucide-react-native";
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

// What Pro unlocks over Free, shown inside the card while Pro is on: a 2×2
// checklist (benefits, not tappable chips), in the card's accent family.
const PERKS = ["Unlimited saves", "Unlimited searches", "Unlimited suggestions", "Every pantry match"];

function ProPerks() {
  return (
    <View className="flex-row flex-wrap border-t border-accent/15 pt-3" style={{ rowGap: 8 }} accessibilityLabel={`Included: ${PERKS.join(", ")}`}>
      {PERKS.map((perk) => (
        <View key={perk} className="w-1/2 flex-row items-center gap-1.5 pr-2">
          <View className="h-4 w-4 items-center justify-center rounded-full bg-accent/15">
            <Check color={colors.accent} size={10} strokeWidth={3.5} />
          </View>
          <Text numberOfLines={1} className="shrink font-inter-semibold text-small text-ink-emphasis">
            {perk}
          </Text>
        </View>
      ))}
    </View>
  );
}

// A draining bar with its caption (a trial's or a cancelled plan's time
// left, earned Pro's days left).
function TimeBar({ value, caption, muted = false }: { value: number; caption: string; muted?: boolean }) {
  const fill = useSharedValue(0);
  useEffect(() => {
    fill.value = withTiming(Math.min(1, Math.max(0.04, value)), { duration: 700, easing: Easing.out(Easing.cubic) });
  }, [value, fill]);
  const fillStyle = useAnimatedStyle(() => ({ width: `${fill.value * 100}%` }));
  return (
    <View className="gap-1.5">
      <View className="h-1.5 overflow-hidden rounded-full bg-ink-emphasis/10">
        <Animated.View style={[{ height: "100%" }, fillStyle]}>
          <View className={`flex-1 rounded-full ${muted ? "bg-ink-subtle" : "bg-accent"}`} />
        </Animated.View>
      </View>
      <Text className="font-inter-medium text-sub text-ink-subtle">{caption}</Text>
    </View>
  );
}

// Settings > Pro's "your plan" card: plan, status, what happens next and (on
// a trial or a cancelled plan) how much time is left. Tap to manage; an
// expired plan (Pro ended recently) taps through to renew instead.
export function ProPlanCard({ subscription, onPress }: { subscription: ProSubscription; onPress: () => void }) {
  const chip = STATUS_CHIP[subscription.status];
  const expired = subscription.status === "expired";
  const progress = progressOf(subscription);

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
        {progress && <TimeBar value={progress.value} caption={progress.caption} muted={subscription.status === "cancelled"} />}
        {!expired && <ProPerks />}
      </Pressable>
    </Animated.View>
  );
}

// Earned days come in 7s (a first approved recipe, a first photo post), so
// the bar measures against the 7-day blocks still running.
const DAY_MS = 24 * 60 * 60 * 1000;
const earnedShare = (until: string) => {
  const left = new Date(until).getTime() - Date.now();
  return left / (Math.max(1, Math.ceil(left / (7 * DAY_MS))) * 7 * DAY_MS);
};

// Settings > Pro while earned Pro is running with no subscription (Pro
// rewards). Same shape as the plan card: the PRO badge and "Earned Pro"
// (no extra EARNED chip: that said it a third time), when it ends and why,
// the days left draining, and what's included. Tap to see Pro and
// subscribe to keep it.
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
          <ChevronRight color={colors.ink.subtle} size={18} />
        </View>
        <Text className="font-inter-regular text-small text-ink-subtle">
          Free until {formatPlanDate(until)}, for sharing with the community. Subscribe to keep it after.
        </Text>
        <TimeBar value={earnedShare(until)} caption={`${timeLeft(until)} left`} />
        <ProPerks />
      </Pressable>
    </Animated.View>
  );
}
