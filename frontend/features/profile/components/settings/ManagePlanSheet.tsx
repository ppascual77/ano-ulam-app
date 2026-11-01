import { ReactNode, useEffect, useRef, useState } from "react";
import { Pressable, Text, View } from "react-native";
import Animated, { FadeIn, FadeInRight, FadeOut, ZoomIn } from "react-native-reanimated";
import * as Haptics from "expo-haptics";
import { CalendarClock, Lock, type LucideIcon } from "lucide-react-native";
import { AppText, BottomSheet, Button, ChipSelect, SegmentedSwitch, showGlobalToast } from "@/frontend/components/ui";
import { colors } from "@/frontend/constants/theme";
import { ProBadge } from "@/frontend/core/pro/components/ProBadge";
import { UNLOCKED_FEATURES } from "@/frontend/core/pro/components/unlockedFeatures";
import { useProStore, useProSubscription } from "@/frontend/core/pro/store/useProStore";
import { PLANS, type PlanKey } from "@/frontend/core/pro/proContent";
import { STATUS_LABEL, formatPlanDate, nextLine, planName, priceLine } from "@/frontend/core/pro/subscriptionCopy";
import { usePreferences } from "@/frontend/core/preferences/hooks/usePreferences";
import { useReduceMotion } from "@/frontend/core/preferences/store/useReduceMotionStore";
import { useSavedMeals } from "@/frontend/core/saved/hooks/useSavedMeals";
import { SAVED_MEALS_LIMIT } from "@/frontend/core/saved/types";

type Step = "manage" | "lose" | "reason" | "done";

const REASONS = [
  { id: "price", label: "Too expensive" },
  { id: "usage", label: "Not using it enough" },
  { id: "missing", label: "Missing something" },
  { id: "trying", label: "Just trying it out" },
  { id: "other", label: "Other" },
];

const PLAN_OPTIONS = (Object.keys(PLANS) as PlanKey[]).map((key) => ({ value: key, label: PLANS[key].label }));

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <View className="flex-row items-center justify-between py-2.5">
      <Text className="font-inter-regular text-body text-ink-subtle">{label}</Text>
      <Text className="font-inter-semibold text-body text-ink-emphasis">{value}</Text>
    </View>
  );
}

function StepTitle({ title, body }: { title: string; body?: ReactNode }) {
  return (
    <View className="gap-1">
      <AppText variant="sectionTitle" dot>
        {title}
      </AppText>
      {body != null && <Text className="font-inter-regular text-body text-ink-subtle">{body}</Text>}
    </View>
  );
}

// "If you cancel" lines, made about the user where we can (what they've set
// up), so it reads as what they'd lose, not a feature list.
function useLossLines(): { Icon: LucideIcon; text: string }[] {
  const { prefs } = usePreferences();
  const { data: saved = [] } = useSavedMeals();
  const feature = (key: string) => UNLOCKED_FEATURES.find((f) => f.key === key)!;
  const lines: { Icon: LucideIcon; text: string }[] = [{ Icon: feature("planner").Icon, text: "Your meal plan goes back to 1 day" }];
  const watched = prefs.price_alerts.ingredients.length;
  lines.push({
    Icon: feature("alerts").Icon,
    text: watched > 0 ? `Price alerts stop for ${watched} ${watched === 1 ? "ingredient" : "ingredients"}` : "No more price drop alerts",
  });
  const avoided = prefs.avoid_ingredients.length;
  if (avoided > 0)
    lines.push({
      Icon: feature("avoid").Icon,
      text: `Meals with your ${avoided} avoided ${avoided === 1 ? "ingredient" : "ingredients"} show up again`,
    });
  if (prefs.nutrition_goals.calories) {
    lines.push({
      Icon: feature("goals").Icon,
      text: `Meals stop showing against your ${prefs.nutrition_goals.calories.toLocaleString("en-PH")} kcal goal`,
    });
  }
  if (saved.length > SAVED_MEALS_LIMIT) {
    lines.push({ Icon: feature("saved").Icon, text: `You have ${saved.length} saved meals; free keeps ${SAVED_MEALS_LIMIT}` });
  }
  lines.push({ Icon: feature("unlimited").Icon, text: "Searches and suggestions go back to a daily limit" });
  return lines;
}

// Settings' "Manage your plan": the plan's details, switching between
// Monthly and Yearly, and cancelling (or resuming). Cancelling is a short
// flow in this same sheet: what you'd lose, an optional reason, then a
// calm confirmation (Pro stays on until the period ends). MOCK: nothing is
// charged; "End Pro now" is a test shortcut.
export function ManagePlanSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  // The last plan seen, so the sheet keeps its content while closing after
  // "End Pro now" (the plan is already gone by then).
  const live = useProSubscription();
  const last = useRef(live);
  if (live) last.current = live;
  const subscription = live ?? last.current;
  const { switchPlan, cancel, resume, endNow } = useProStore.getState();
  const reduceMotion = useReduceMotion();
  const [step, setStep] = useState<Step>("manage");
  const [reason, setReason] = useState<string[]>([]);
  const lossLines = useLossLines();

  useEffect(() => {
    if (visible) {
      setStep("manage");
      setReason([]);
    }
  }, [visible]);

  // Steps swap with a short slide (a fade with Reduce motion on).
  const enter = reduceMotion ? FadeIn.duration(180) : FadeInRight.duration(260);
  const exit = FadeOut.duration(120);

  const endDate = subscription ? formatPlanDate(subscription.renewsAt) : "";

  const confirmCancel = () => {
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    cancel();
    setStep("done");
  };

  return (
    <BottomSheet visible={visible} onClose={onClose} fitContent heightPercent={0.9}>
      <View className="px-6 pb-8 pt-10">
        {step === "manage" && subscription && (
          <Animated.View key="manage" entering={enter} exiting={exit}>
            <View className="gap-5">
              <View className="flex-row items-center gap-2">
                <ProBadge />
                <Text className="font-inter-medium text-small text-ink-subtle">{STATUS_LABEL[subscription.status]}</Text>
              </View>
              <StepTitle title={planName(subscription.plan)} body={nextLine(subscription)} />

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
                        message: `You're on ${PLANS[plan].label}. Next charge ₱${PLANS[plan].price} on ${endDate}.`,
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
                    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                    resume();
                    showGlobalToast({ message: "Pro is back on. Nothing changes.", tone: "success" });
                  }}
                />
              ) : (
                <Pressable onPress={() => setStep("lose")} accessibilityRole="button" className="items-center py-2 active:opacity-60">
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

        {step === "lose" && (
          <Animated.View key="lose" entering={enter} exiting={exit}>
            <View className="gap-5">
              <StepTitle title="Before you go" body={`If you cancel, on ${endDate}:`} />
              <View className="gap-3">
                {lossLines.map(({ Icon, text }, i) => (
                  <Animated.View key={text} entering={reduceMotion ? FadeIn.duration(180) : FadeInRight.delay(80 + i * 50).duration(260)}>
                    <View className="flex-row items-center gap-3">
                      <View className="h-9 w-9 items-center justify-center rounded-xl bg-accent/10">
                        <Icon color={colors.accent} size={18} />
                      </View>
                      <Text className="flex-1 font-inter-regular text-body text-ink-emphasis">{text}</Text>
                    </View>
                  </Animated.View>
                ))}
              </View>
              <View className="gap-2">
                <Button label="Keep Pro" onPress={onClose} />
                <Button label="Continue to cancel" variant="muted" onPress={() => setStep("reason")} />
              </View>
            </View>
          </Animated.View>
        )}

        {step === "reason" && (
          <Animated.View key="reason" entering={enter} exiting={exit}>
            <View className="gap-5">
              <StepTitle title="Mind telling us why?" body="Optional. It helps us make Pro worth keeping." />
              <ChipSelect mode="single" options={REASONS} value={reason} onChange={setReason} />
              <View className="gap-2">
                <Pressable onPress={confirmCancel} className="items-center rounded-xl bg-like py-3.5 active:opacity-80">
                  <Text className="font-inter-semibold text-body text-white">Cancel subscription</Text>
                </Pressable>
                <Button label="Keep Pro" variant="muted" onPress={onClose} />
              </View>
            </View>
          </Animated.View>
        )}

        {step === "done" && (
          <Animated.View key="done" entering={FadeIn.duration(reduceMotion ? 200 : 260)}>
            <View className="items-center gap-5">
              <Animated.View entering={reduceMotion ? undefined : ZoomIn.delay(120).springify().damping(12)}>
                <View className="h-16 w-16 items-center justify-center rounded-full bg-ink-emphasis/5">
                  <CalendarClock color={colors.ink.emphasis} size={28} />
                </View>
              </Animated.View>
              <View className="items-center gap-1">
                <AppText variant="sectionTitle" dot className="text-center">
                  Your plan is cancelled
                </AppText>
                <Text className="text-center font-inter-regular text-body text-ink-subtle">
                  Pro stays on until {endDate}, and you won&apos;t be charged. Changed your mind? Resume anytime in Settings.
                </Text>
              </View>
              <View className="flex-row items-center gap-2 rounded-full bg-ink-emphasis/5 px-3 py-1.5">
                <Lock color={colors.ink.subtle} size={12} />
                <Text className="font-inter-medium text-small text-ink-subtle">Pro features lock on {endDate}</Text>
              </View>
              <View className="w-full">
                <Button label="Done" onPress={onClose} />
              </View>
            </View>
          </Animated.View>
        )}
      </View>
    </BottomSheet>
  );
}
