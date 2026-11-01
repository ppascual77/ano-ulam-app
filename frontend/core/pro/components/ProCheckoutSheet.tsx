import { useEffect, useState } from "react";
import { Image as RNImage, Text, View } from "react-native";
import * as Haptics from "expo-haptics";
import { AppText, BottomSheet, Button } from "@/frontend/components/ui";
import { PLANS, TRIAL_DAYS, type PlanKey } from "../proContent";
import { formatPlanDate, priceLine } from "../subscriptionCopy";

type ProCheckoutSheetProps = {
  visible: boolean;
  plan: PlanKey;
  onClose: () => void;
  /** Confirmed: the sheet closes, then onClosed runs (start the unlock there). */
  onConfirm: () => void;
  onClosed?: () => void;
};

// How long the mock "store" takes to confirm, so the button's loading wave
// reads as a real purchase going through.
const CONFIRM_MS = 1200;

// One step of the trial timeline: a dot (filled = today) on a rail.
function Step({ when, what, first, last }: { when: string; what: string; first?: boolean; last?: boolean }) {
  return (
    <View className="flex-row gap-3">
      <View className="w-4 items-center">
        <View className={`w-0.5 flex-1 ${first ? "bg-transparent" : "bg-ink-emphasis/10"}`} />
        <View className={`h-3 w-3 rounded-full ${first ? "bg-primary" : "border-2 border-ink-emphasis/20 bg-white"}`} />
        <View className={`w-0.5 flex-1 ${last ? "bg-transparent" : "bg-ink-emphasis/10"}`} />
      </View>
      <View className="flex-1 py-2">
        <Text className="font-inter-semibold text-body text-ink-emphasis">{when}</Text>
        <Text className="font-inter-regular text-small text-ink-subtle">{what}</Text>
      </View>
    </View>
  );
}

// The mock "store" sheet before Pro unlocks: what you're starting, when the
// first charge would be, and how to avoid it. Clearly a test: nothing is
// charged (there are no subscriptions yet).
export function ProCheckoutSheet({ visible, plan, onClose, onConfirm, onClosed }: ProCheckoutSheetProps) {
  const [confirming, setConfirming] = useState(false);
  useEffect(() => {
    if (visible) setConfirming(false);
  }, [visible]);

  const option = PLANS[plan];
  const firstCharge = formatPlanDate(new Date(Date.now() + TRIAL_DAYS * 24 * 60 * 60 * 1000).toISOString());

  const confirm = () => {
    if (confirming) return;
    setConfirming(true);
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setTimeout(onConfirm, CONFIRM_MS);
  };

  return (
    <BottomSheet
      visible={visible}
      onClose={confirming ? () => {} : onClose}
      onClosed={onClosed}
      presentation="inline"
      fitContent
      heightPercent={0.85}
    >
      <View className="gap-5 px-6 pb-8 pt-10">
        <View className="flex-row items-center gap-3">
          <RNImage source={require("@/assets/icon.png")} className="h-12 w-12 rounded-xl border border-ink-emphasis/10" />
          <View className="flex-1">
            <AppText variant="title">AnoUlam Pro</AppText>
            <Text className="font-inter-regular text-small text-ink-subtle">
              {option.label} · {priceLine(plan)}
            </Text>
          </View>
          <View className="rounded-full bg-notice-bg px-2 py-1">
            <Text className="font-inter-bold text-sub text-notice-text">TEST</Text>
          </View>
        </View>

        <View className="rounded-2xl border border-ink-emphasis/10 px-4 py-2">
          <Step first when="Today" what={`₱0 · ${TRIAL_DAYS} days of Pro, free`} />
          <Step when={`${firstCharge}`} what={`₱${option.price}, then every ${option.per}`} last />
        </View>

        <Text className="font-inter-regular text-small text-ink-subtle">
          Cancel anytime in Settings before {firstCharge} and you won&apos;t be charged.
        </Text>

        <View className="gap-2">
          <Button label={confirming ? "Confirming…" : "Start free trial"} variant="secondary" loading={confirming} onPress={confirm} />
          <Text className="text-center font-inter-regular text-sub text-ink-subtle">Test purchase. No payment is taken.</Text>
        </View>
      </View>
    </BottomSheet>
  );
}
