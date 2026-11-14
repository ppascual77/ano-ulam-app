import { useRef } from "react";
import { Image as RNImage, View } from "react-native";
import { Text } from "@/frontend/components/ui/Text";
import { AppText, BottomSheet, Button, showGlobalToast } from "@/frontend/components/ui";
import { colors } from "@/frontend/constants/theme";
import { manageSubscription, useProSubscription, type ProSubscription } from "@/frontend/core/pro/store/useProStore";
import { STATUS_LABEL, formatPlanDate, planName, priceLine, timeLeft } from "@/frontend/core/pro/subscriptionCopy";
import { STATUS_CHIP } from "./ProPlanCard";

// The one thing to know right now, as a headline and a line under it.
function summaryOf(sub: ProSubscription): { title: string; body: string } {
  const date = formatPlanDate(sub.renewsAt);
  if (sub.status === "trial") {
    return {
      title: `${timeLeft(sub.renewsAt)} left in your trial`,
      body: `Then ${priceLine(sub.plan)}, starting ${date}.`,
    };
  }
  if (sub.status === "active") return { title: `Renews ${date}`, body: `${priceLine(sub.plan)}, through your Apple ID.` };
  return { title: `Pro until ${date}`, body: "Your subscription is cancelled. You won't be charged." };
}

// Settings' "Manage your plan": the plan, its status and the one thing to
// know (days left, next charge, or when Pro ends). Switching plans,
// cancelling and resuming happen in Apple's own subscription screen (Apple
// owns the subscription), which the button opens; coming back, Settings
// re-reads Pro.
export function ManagePlanSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  // The last plan seen, so the sheet keeps its content while closing after
  // Pro ends.
  const live = useProSubscription();
  const last = useRef(live);
  if (live) last.current = live;
  const subscription = live ?? last.current;

  if (!subscription) return null;
  const summary = summaryOf(subscription);
  const chip = STATUS_CHIP[subscription.status];

  const openAppStore = async () => {
    try {
      await manageSubscription();
    } catch {
      showGlobalToast({ message: "Couldn't open your subscriptions. Try Settings > Apple ID > Subscriptions.", tone: "error" });
    }
  };

  return (
    <BottomSheet visible={visible} onClose={onClose} fitContent heightPercent={0.9}>
      <View className="px-6 pb-6 pt-10">
        <View className="flex-row items-center gap-3">
          <RNImage
            source={require("@/assets/icon.png")}
            style={{ width: 48, height: 48, borderRadius: 14, borderWidth: 1, borderColor: `${colors.ink.emphasis}1A` }}
          />
          <View className="flex-1">
            <Text className="font-inter-bold text-subheading text-ink-emphasis">{planName(subscription.plan)}</Text>
            <Text className="font-inter-regular text-small text-ink-subtle">Since {formatPlanDate(subscription.startedAt)}</Text>
          </View>
          <View className={`rounded-full px-2.5 py-1 ${chip.bg}`}>
            <Text className={`font-inter-bold text-sub ${chip.text}`}>{STATUS_LABEL[subscription.status].toUpperCase()}</Text>
          </View>
        </View>

        <View className="mt-6">
          <AppText variant="sectionTitle" dot>
            {summary.title}
          </AppText>
          <Text className="mt-1 font-inter-regular text-body text-ink-subtle">{summary.body}</Text>
        </View>

        <View className="mt-5 h-px bg-ink-emphasis/10" />

        <Text className="mt-5 font-inter-regular text-small text-ink-subtle">
          Your subscription is with Apple. Switch between Monthly and Yearly, cancel, or turn it back on in the App Store.
        </Text>
        <View className="mt-4">
          <Button
            label={subscription.status === "cancelled" ? "Resume in the App Store" : "Manage in the App Store"}
            variant="muted"
            onPress={() => void openAppStore()}
          />
        </View>
      </View>
    </BottomSheet>
  );
}
