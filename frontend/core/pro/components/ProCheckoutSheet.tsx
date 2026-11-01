import { useEffect, useState } from "react";
import { Image as RNImage, Text, View } from "react-native";
import * as Haptics from "expo-haptics";
import { CreditCard, LockOpen, ShieldCheck, type LucideIcon } from "lucide-react-native";
import { AppText, BottomSheet, Button } from "@/frontend/components/ui";
import { colors } from "@/frontend/constants/theme";
import { PLANS, TRIAL_DAYS, type PlanKey } from "../proContent";
import { formatPlanDate } from "../subscriptionCopy";

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

// One step of the timeline: an icon on the rail, what happens, and what it
// costs. `now` is today's step (filled); the next one is outlined.
function TimelineStep({
  Icon,
  when,
  what,
  amount,
  now = false,
  last = false,
}: {
  Icon: LucideIcon;
  when: string;
  what: string;
  amount: string;
  now?: boolean;
  last?: boolean;
}) {
  return (
    <View className="flex-row gap-3">
      <View className="items-center">
        <View
          className={`h-9 w-9 items-center justify-center rounded-full ${now ? "bg-primary" : "border-2 border-ink-emphasis/15 bg-white"}`}
        >
          <Icon color={now ? colors.white : colors.ink.subtle} size={16} />
        </View>
        {!last && <View className="my-1 w-0.5 flex-1 rounded-full bg-primary/20" />}
      </View>
      <View className={`flex-1 flex-row items-start gap-3 ${last ? "" : "pb-5"}`}>
        <View className="flex-1 pt-1">
          <Text className="font-inter-bold text-body text-ink-emphasis">{when}</Text>
          <Text className="mt-0.5 font-inter-regular text-small text-ink-subtle">{what}</Text>
        </View>
        <Text className={`pt-1 font-inter-bold text-body ${now ? "text-primary" : "text-ink-emphasis"}`}>{amount}</Text>
      </View>
    </View>
  );
}

// The mock "store" sheet before Pro unlocks, a simple white receipt: the
// plan, what the trial is, when the first charge would be, what's due today
// (nothing) and how to avoid paying. Clearly a test: nothing is charged.
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
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setTimeout(onConfirm, CONFIRM_MS);
  };

  return (
    <BottomSheet
      visible={visible}
      onClose={confirming ? () => {} : onClose}
      onClosed={onClosed}
      presentation="inline"
      fitContent
      heightPercent={0.92}
    >
      <View className="px-6 pt-10">
        <View className="flex-row items-center gap-3">
          <RNImage
            source={require("@/assets/icon.png")}
            style={{ width: 48, height: 48, borderRadius: 14, borderWidth: 1, borderColor: `${colors.ink.emphasis}1A` }}
          />
          <View className="flex-1">
            <Text className="font-inter-bold text-subheading text-ink-emphasis">AnoUlam Pro</Text>
            <Text className="font-inter-regular text-small text-ink-subtle">
              {option.label} · ₱{option.price}/{option.per}
            </Text>
          </View>
          <View className="rounded-full bg-notice-bg px-2.5 py-1">
            <Text className="font-inter-bold text-sub text-notice-text">TEST</Text>
          </View>
        </View>

        <View className="mt-6">
          <AppText variant="sectionTitle" dot>
            {`${TRIAL_DAYS} days of Pro, free`}
          </AppText>
          <Text className="mt-1 font-inter-regular text-body text-ink-subtle">Try everything in Pro. Cancel anytime.</Text>
        </View>
      </View>

      <View className="mx-6 mt-5 h-px bg-ink-emphasis/10" />

      <View className="gap-5 px-6 pb-6 pt-5">
        <View>
          <TimelineStep now Icon={LockOpen} when="Today" what={`Every Pro feature, free for ${TRIAL_DAYS} days`} amount="₱0" />
          <TimelineStep
            last
            Icon={CreditCard}
            when={firstCharge}
            what={`Then every ${option.per}. Cancel before ${firstCharge} in Settings and pay nothing.`}
            amount={`₱${option.price}`}
          />
        </View>

        <View className="flex-row items-end justify-between rounded-2xl bg-notice-positive-bg px-4 py-3.5">
          <View>
            <Text className="font-inter-semibold text-body text-ink-emphasis">Due today</Text>
            <Text className="font-inter-regular text-small text-ink-subtle">No charge during your trial</Text>
          </View>
          <Text className="font-inter-extrabold text-heading tracking-display text-primary">₱0.00</Text>
        </View>

        <View className="gap-3">
          <Button label={confirming ? "Confirming…" : "Start free trial"} variant="secondary" loading={confirming} onPress={confirm} />
          <View className="flex-row items-center justify-center gap-1.5">
            <ShieldCheck color={colors.ink.subtle} size={14} />
            <Text className="font-inter-regular text-small text-ink-subtle">Test purchase. No payment is taken.</Text>
          </View>
        </View>
      </View>
    </BottomSheet>
  );
}
