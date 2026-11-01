import { useEffect, useRef, useState } from "react";
import { Pressable, Text, View } from "react-native";
import Animated, { FadeIn, FadeOut } from "react-native-reanimated";
import * as Haptics from "expo-haptics";
import { AppText, BottomSheet, Button, SegmentedSwitch, showGlobalToast } from "@/frontend/components/ui";
import { ProBadge } from "@/frontend/core/pro/components/ProBadge";
import { useProStore, useProSubscription } from "@/frontend/core/pro/store/useProStore";
import { PLANS, type PlanKey } from "@/frontend/core/pro/proContent";
import { STATUS_LABEL, formatPlanDate, nextLine, planName, priceLine } from "@/frontend/core/pro/subscriptionCopy";

type Step = "manage" | "confirm";

const PLAN_OPTIONS = (Object.keys(PLANS) as PlanKey[]).map((key) => ({ value: key, label: PLANS[key].label }));

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <View className="flex-row items-center justify-between py-2.5">
      <Text className="font-inter-regular text-body text-ink-subtle">{label}</Text>
      <Text className="font-inter-semibold text-body text-ink-emphasis">{value}</Text>
    </View>
  );
}

// Settings' "Manage your plan": the plan's details, switching between
// Monthly and Yearly, and cancelling (or resuming). Cancelling is one plain
// confirmation in the same sheet: when Pro ends and that nothing is charged,
// no persuasion. MOCK: nothing is charged; "End Pro now" is a test shortcut.
export function ManagePlanSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  // The last plan seen, so the sheet keeps its content while closing after
  // "End Pro now" (the plan is already gone by then).
  const live = useProSubscription();
  const last = useRef(live);
  if (live) last.current = live;
  const subscription = live ?? last.current;
  const { switchPlan, cancel, resume, endNow } = useProStore.getState();
  const [step, setStep] = useState<Step>("manage");

  useEffect(() => {
    if (visible) setStep("manage");
  }, [visible]);

  if (!subscription) return null;
  const endDate = formatPlanDate(subscription.renewsAt);

  const confirmCancel = () => {
    void Haptics.selectionAsync();
    cancel();
    onClose();
    showGlobalToast({ message: `Subscription cancelled. Pro stays on until ${endDate}.`, tone: "success" });
  };

  return (
    <BottomSheet visible={visible} onClose={onClose} fitContent heightPercent={0.9}>
      <View className="px-6 pb-8 pt-10">
        {step === "manage" && (
          <Animated.View key="manage" entering={FadeIn.duration(180)} exiting={FadeOut.duration(120)}>
            <View className="gap-5">
              <View className="gap-1">
                <View className="flex-row items-center gap-2">
                  <ProBadge />
                  <Text className="font-inter-medium text-small text-ink-subtle">{STATUS_LABEL[subscription.status]}</Text>
                </View>
                <AppText variant="sectionTitle" dot>
                  {planName(subscription.plan)}
                </AppText>
                <Text className="font-inter-regular text-body text-ink-subtle">{nextLine(subscription)}</Text>
              </View>

              <View className="rounded-2xl border border-ink-emphasis/10 px-4 py-1">
                <DetailRow label="Price" value={priceLine(subscription.plan)} />
                <DetailRow label="Started" value={formatPlanDate(subscription.startedAt)} />
                <DetailRow
                  label={subscription.status === "cancelled" ? "Pro until" : subscription.status === "trial" ? "First charge" : "Renews"}
                  value={endDate}
                />
              </View>

              {subscription.status !== "cancelled" && (
                <View className="gap-2">
                  <Text className="font-inter-semibold text-body text-ink-emphasis">Plan</Text>
                  <SegmentedSwitch
                    size="md"
                    options={PLAN_OPTIONS}
                    value={subscription.plan}
                    onChange={(plan) => {
                      if (plan === subscription.plan) return;
                      void Haptics.selectionAsync();
                      switchPlan(plan);
                      showGlobalToast({
                        message: `Switched to ${PLANS[plan].label}. Next charge ₱${PLANS[plan].price} on ${endDate}.`,
                        tone: "success",
                      });
                    }}
                  />
                </View>
              )}

              {subscription.status === "cancelled" ? (
                <Button
                  label="Resume Pro"
                  onPress={() => {
                    resume();
                    showGlobalToast({ message: "Pro will renew as before.", tone: "success" });
                  }}
                />
              ) : (
                <Pressable onPress={() => setStep("confirm")} accessibilityRole="button" className="items-center py-2 active:opacity-60">
                  <Text className="font-inter-semibold text-body text-like">Cancel subscription</Text>
                </Pressable>
              )}

              <Pressable
                onPress={() => {
                  endNow();
                  onClose();
                  showGlobalToast({ message: "Pro ended (test)", tone: "success" });
                }}
                accessibilityRole="button"
                className="items-center border-t border-ink-emphasis/10 pt-4 active:opacity-60"
              >
                <Text className="font-inter-regular text-small text-ink-subtle">End Pro now (test)</Text>
              </Pressable>
            </View>
          </Animated.View>
        )}

        {step === "confirm" && (
          <Animated.View key="confirm" entering={FadeIn.duration(180)} exiting={FadeOut.duration(120)}>
            <View className="gap-5">
              <View className="gap-1">
                <AppText variant="sectionTitle" dot>
                  Cancel your subscription?
                </AppText>
                <Text className="font-inter-regular text-body text-ink-subtle">
                  You&apos;ll keep Pro until {endDate}, then your account goes back to Free. You won&apos;t be charged.
                </Text>
              </View>
              <View className="flex-row gap-3">
                <Pressable
                  onPress={() => setStep("manage")}
                  className="flex-1 items-center rounded-xl border border-ink-emphasis/15 py-3.5 active:bg-ink-emphasis/5"
                >
                  <Text className="font-inter-semibold text-body text-ink-emphasis">Go back</Text>
                </Pressable>
                <Pressable onPress={confirmCancel} className="flex-1 items-center rounded-xl bg-like py-3.5 active:opacity-80">
                  <Text className="font-inter-semibold text-body text-white">Cancel subscription</Text>
                </Pressable>
              </View>
            </View>
          </Animated.View>
        )}
      </View>
    </BottomSheet>
  );
}
