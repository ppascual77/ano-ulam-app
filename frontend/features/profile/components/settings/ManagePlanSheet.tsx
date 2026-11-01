import { useEffect, useRef, useState } from "react";
import { Image as RNImage, Pressable, Text, View } from "react-native";
import Animated, { FadeIn, FadeOut } from "react-native-reanimated";
import * as Haptics from "expo-haptics";
import { Check } from "lucide-react-native";
import { AppText, BottomSheet, Button, showGlobalToast } from "@/frontend/components/ui";
import { colors } from "@/frontend/constants/theme";
import { useProStore, useProSubscription, type ProSubscription } from "@/frontend/core/pro/store/useProStore";
import { PLANS, YEARLY_SAVE_PCT, type PlanKey } from "@/frontend/core/pro/proContent";
import { STATUS_LABEL, daysUntil, formatPlanDate } from "@/frontend/core/pro/subscriptionCopy";
import { STATUS_CHIP } from "./ProPlanCard";

type Step = "manage" | "confirm" | "switch";

// The one thing to know right now, as a headline and a line under it.
function summaryOf(sub: ProSubscription): { title: string; body: string } {
  const date = formatPlanDate(sub.renewsAt);
  const price = `₱${PLANS[sub.plan].price}`;
  if (sub.status === "trial") {
    const left = daysUntil(sub.renewsAt);
    return {
      title: `${left} ${left === 1 ? "day" : "days"} left in your trial`,
      body: `Your first charge of ${price} is on ${date}.`,
    };
  }
  if (sub.status === "active" && sub.nextPlan) {
    return { title: `Renews ${date}`, body: `Switching to ${PLANS[sub.nextPlan].label}: ₱${PLANS[sub.nextPlan].price} will be charged on ${date}.` };
  }
  if (sub.status === "active") return { title: `Renews ${date}`, body: `${price} will be charged on ${date}.` };
  return { title: `Pro until ${date}`, body: "Your subscription is cancelled. You won't be charged." };
}

// A plan to switch to: full width, a check on the current one, and a tag
// on one scheduled to start at the next renewal.
function PlanOption({ planKey, selected, tag, onPress }: { planKey: PlanKey; selected: boolean; tag?: string; onPress: () => void }) {
  const option = PLANS[planKey];
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      className={`flex-row items-center gap-3 rounded-2xl border px-4 py-3.5 ${
        selected ? "border-primary bg-primary/5" : "border-ink-emphasis/10 active:bg-ink-emphasis/5"
      }`}
    >
      <View className="flex-1">
        <View className="flex-row items-center gap-2">
          <Text className="font-inter-semibold text-body text-ink-emphasis">{option.label}</Text>
          {planKey === "yearly" && (
            <View className="rounded-full bg-accent/10 px-2 py-0.5">
              <Text className="font-inter-bold text-sub text-accent">SAVE {YEARLY_SAVE_PCT}%</Text>
            </View>
          )}
          {tag && (
            <View className="rounded-full bg-info-soft px-2 py-0.5">
              <Text className="font-inter-bold text-sub text-info">{tag.toUpperCase()}</Text>
            </View>
          )}
        </View>
        <Text className="mt-0.5 font-inter-regular text-small text-ink-subtle">
          ₱{option.price}/{option.per}
          {planKey === "yearly" ? ` · ₱${Math.round(option.price / 12)} a month` : ""}
        </Text>
      </View>
      <View
        className={`h-6 w-6 items-center justify-center rounded-full ${selected ? "bg-primary" : "border-2 border-ink-emphasis/15"}`}
      >
        {selected && <Check color={colors.white} size={14} strokeWidth={3} />}
      </View>
    </Pressable>
  );
}

// Settings' "Manage your plan", in the same style as the checkout: the plan
// and its status, the one thing to know (days left, next charge, or when Pro
// ends), the plans to switch between, then cancel (or resume). Switching and
// cancelling each confirm first, in the same sheet: a switch says when it
// happens (now during the trial, else at the next renewal) and what it costs. MOCK: nothing is charged; "End
// Pro now" is a test shortcut.
export function ManagePlanSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  // The last plan seen, so the sheet keeps its content while closing after
  // "End Pro now" (the plan is already gone by then).
  const live = useProSubscription();
  const last = useRef(live);
  if (live) last.current = live;
  const subscription = live ?? last.current;
  const { switchPlan, cancel, resume, endNow } = useProStore.getState();
  const [step, setStep] = useState<Step>("manage");
  // The plan the switch step is about.
  const [target, setTarget] = useState<PlanKey>("monthly");

  useEffect(() => {
    if (visible) setStep("manage");
  }, [visible]);

  if (!subscription) return null;
  const endDate = formatPlanDate(subscription.renewsAt);
  const summary = summaryOf(subscription);
  const chip = STATUS_CHIP[subscription.status];
  const cancelled = subscription.status === "cancelled";

  // Tapping a plan never switches straight away: it opens the switch step,
  // which says when the change happens and what it costs.
  const scheduled = subscription.nextPlan;
  const choosePlan = (plan: PlanKey) => {
    const nothingToChange = scheduled ? plan === scheduled : plan === subscription.plan;
    if (nothingToChange) return;
    void Haptics.selectionAsync();
    setTarget(plan);
    setStep("switch");
  };
  // Back to the current plan while a switch is scheduled: calling it off.
  const keeping = !!scheduled && target === subscription.plan;
  const inTrial = subscription.status === "trial";
  const targetPlan = PLANS[target];
  const currentPlan = PLANS[subscription.plan];

  const confirmSwitch = () => {
    void Haptics.selectionAsync();
    switchPlan(target);
    setStep("manage");
    showGlobalToast({
      message: keeping
        ? `You'll stay on ${currentPlan.label}.`
        : inTrial
          ? `Switched to ${targetPlan.label}.`
          : `${targetPlan.label} starts on ${endDate}.`,
      tone: "success",
    });
  };

  const confirmCancel = () => {
    void Haptics.selectionAsync();
    cancel();
    onClose();
    showGlobalToast({ message: `Subscription cancelled. Pro stays on until ${endDate}.`, tone: "success" });
  };

  return (
    <BottomSheet visible={visible} onClose={onClose} fitContent heightPercent={0.9}>
      <View className="px-6 pb-6 pt-10">
        {step === "manage" && (
          <Animated.View key="manage" entering={FadeIn.duration(180)} exiting={FadeOut.duration(120)}>
            <View className="flex-row items-center gap-3">
              <RNImage
                source={require("@/assets/icon.png")}
                style={{ width: 48, height: 48, borderRadius: 14, borderWidth: 1, borderColor: `${colors.ink.emphasis}1A` }}
              />
              <View className="flex-1">
                <Text className="font-inter-bold text-subheading text-ink-emphasis">AnoUlam Pro</Text>
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

            {!cancelled && (
              <View className="mt-5 gap-2.5">
                <Text className="font-inter-semibold text-body text-ink-emphasis">Your plan</Text>
                {(Object.keys(PLANS) as PlanKey[]).map((key) => (
                  <PlanOption
                    key={key}
                    planKey={key}
                    selected={subscription.plan === key}
                    tag={scheduled === key ? `Starts ${endDate}` : undefined}
                    onPress={() => choosePlan(key)}
                  />
                ))}
              </View>
            )}

            <View className="mt-6 gap-3">
              {cancelled ? (
                <Button
                  label="Resume Pro"
                  onPress={() => {
                    resume();
                    showGlobalToast({ message: "Pro will renew as before.", tone: "success" });
                  }}
                />
              ) : (
                <Pressable
                  onPress={() => setStep("confirm")}
                  accessibilityRole="button"
                  className="items-center rounded-xl border border-ink-emphasis/15 py-3.5 active:bg-ink-emphasis/5"
                >
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
                hitSlop={8}
                className="items-center py-1 active:opacity-60"
              >
                <Text className="font-inter-regular text-small text-ink-subtle">End Pro now (test)</Text>
              </Pressable>
            </View>
          </Animated.View>
        )}

        {step === "switch" && (
          <Animated.View key="switch" entering={FadeIn.duration(180)} exiting={FadeOut.duration(120)}>
            <View className="gap-5">
              <View className="gap-1">
                <AppText variant="sectionTitle" dot>
                  {keeping ? `Stay on ${currentPlan.label}?` : `Switch to ${targetPlan.label}?`}
                </AppText>
                <Text className="font-inter-regular text-body text-ink-subtle">
                  {keeping
                    ? `Your switch to ${PLANS[scheduled!].label} on ${endDate} is called off. You'll keep paying ₱${currentPlan.price}/${currentPlan.per}.`
                    : inTrial
                      ? `Your free trial carries on. Your first charge will be ₱${targetPlan.price} on ${endDate}, then every ${targetPlan.per}.`
                      : `You'll stay on ${currentPlan.label} until ${endDate}. Then ${targetPlan.label} starts and ₱${targetPlan.price} is charged, then every ${targetPlan.per}.`}
                </Text>
              </View>

              {!keeping && (
                <View className="rounded-2xl border border-ink-emphasis/10 px-4">
                  <View className="flex-row items-center justify-between border-b border-ink-emphasis/10 py-3">
                    <Text className="font-inter-regular text-body text-ink-subtle">Now</Text>
                    <Text className="font-inter-medium text-body text-ink-subtle">
                      {currentPlan.label} · ₱{currentPlan.price}/{currentPlan.per}
                    </Text>
                  </View>
                  <View className="flex-row items-center justify-between py-3">
                    <Text className="font-inter-regular text-body text-ink-subtle">{inTrial ? "New" : `From ${endDate}`}</Text>
                    <Text className="font-inter-bold text-body text-ink-emphasis">
                      {targetPlan.label} · ₱{targetPlan.price}/{targetPlan.per}
                    </Text>
                  </View>
                </View>
              )}

              <View className="flex-row gap-3">
                <Pressable
                  onPress={() => setStep("manage")}
                  className="flex-1 items-center rounded-xl border border-ink-emphasis/15 py-3.5 active:bg-ink-emphasis/5"
                >
                  <Text className="font-inter-semibold text-body text-ink-emphasis">Go back</Text>
                </Pressable>
                <Pressable onPress={confirmSwitch} className="flex-1 items-center rounded-xl bg-primary py-3.5 active:opacity-80">
                  <Text className="font-inter-semibold text-body text-white">{keeping ? `Stay on ${currentPlan.label}` : "Switch plan"}</Text>
                </Pressable>
              </View>
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
