import { useEffect, useState } from "react";
import { Pressable, Text, View } from "react-native";
import Animated, { FadeIn, FadeInDown, useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";
import { ArrowLeft, Check } from "lucide-react-native";
import { Spinner } from "@/frontend/components/ui";
import { colors } from "@/frontend/constants/theme";
import { Image } from "expo-image";

// Mock generation: a timed checklist (no backend wait), ~3.3s in total.
const STEP_MS = 650;

// Each step reads as work in progress, then as done (past tense).
type Step = { title: string; detail: string; doneDetail: string };

function steps(budgetLabel: string, hasMacros: boolean): Step[] {
  return [
    { title: "Checking your budget", detail: `Finding meals within ${budgetLabel}`, doneDetail: `Found meals within ${budgetLabel}` },
    { title: "Matching meals to your preferences", detail: "Considering your dietary choices", doneDetail: "Filtered based on your choices" },
    hasMacros
      ? { title: "Balancing your calories & macros", detail: "Making sure it fits your goals", doneDetail: "Adjusted to fit your goals" }
      : { title: "Balancing your meals", detail: "Keeping each day filling and varied", doneDetail: "Kept each day filling and varied" },
    { title: "Planning your 5 days", detail: "Picking the best meal combinations", doneDetail: "Picked the best meal combinations" },
    { title: "Building your meal plan", detail: "Putting everything together", doneDetail: "Put everything together" },
  ];
}

function StepIcon({ state }: { state: "pending" | "active" | "done" }) {
  if (state === "done") {
    return (
      <Animated.View entering={FadeIn.duration(200)} className="h-5 w-5 items-center justify-center rounded-full bg-brand-green">
        <Check color={colors.white} size={12} strokeWidth={3} />
      </Animated.View>
    );
  }
  if (state === "active") return <Spinner size={20} thickness={2} color={colors.brandGreen.DEFAULT} trackColor={colors.webDivider} />;
  return <View className="h-5 w-5 rounded-full border-2 border-web-ink-faint" />;
}

type GeneratingViewProps = {
  budgetLabel: string;
  hasMacros: boolean;
  /** Back arrow: cancel and return to setup. */
  onBack: () => void;
  /** After the last step completes. */
  onDone: () => void;
};

// "Planning your week...": the steps tick off one by one, then onDone.
export function GeneratingView({ budgetLabel, hasMacros, onBack, onDone }: GeneratingViewProps) {
  const list = steps(budgetLabel, hasMacros);
  // Index of the step in progress; list.length = all done.
  const [active, setActive] = useState(0);
  const progress = useSharedValue(0);
  const doneCount = Math.min(active, list.length);

  useEffect(() => {
    progress.value = withTiming(doneCount / list.length, { duration: 300 });
    if (active >= list.length) {
      const timer = setTimeout(onDone, 450);
      return () => clearTimeout(timer);
    }
    const timer = setTimeout(() => setActive((i) => i + 1), STEP_MS);
    return () => clearTimeout(timer);
  }, [active]);

  const barStyle = useAnimatedStyle(() => ({ width: `${progress.value * 100}%` }));

  return (
    <View className="flex-1 px-6 pt-2">
      <Pressable onPress={onBack} hitSlop={10} accessibilityLabel="Back" className="self-start py-2">
        <ArrowLeft color={colors.webInk.DEFAULT} size={20} />
      </Pressable>

      <View className="mt-4 items-center">
        {/* Reuses onboarding's illustration until the planner's own arrives. */}
        <Image source={require("@/assets/onboarding/slide-2.gif")} style={{ width: 160, height: 158 }} contentFit="contain" />
      </View>

      <View className="mt-6 items-center">
        <Text className="text-center font-inter-bold text-heading-lg text-web-ink">Planning your week...</Text>
        <Text className="mt-2 px-6 text-center font-inter-regular text-subheading text-web-ink-muted">
          Finding the best meals for your budget, preferences, and nutrition goals.
        </Text>
      </View>

      <View className="mx-7 mt-6 flex-row items-center gap-3">
        <View className="h-1.5 flex-1 overflow-hidden rounded-full bg-web-divider">
          <Animated.View style={barStyle} className="h-full rounded-full bg-brand-green" />
        </View>
        <Text className="font-inter-medium text-small text-web-ink-muted">
          {doneCount}/{list.length}
        </Text>
      </View>

      <View className="mx-7 mt-6 gap-4">
        {list.map((step, i) => {
          const state = i < active ? "done" : i === active ? "active" : "pending";
          const done = state === "done";
          return (
            <Animated.View key={step.title} entering={FadeInDown.delay(i * 60).duration(250)} className="flex-row items-start gap-3">
              <View className="pt-0.5">
                <StepIcon state={state} />
              </View>
              <View className="flex-1">
                <Text
                  className={`font-inter-medium text-subheading ${done ? "text-web-ink-muted" : state === "active" ? "text-web-ink" : "text-web-ink-body"}`}
                >
                  {step.title}
                </Text>
                <Text className={`mt-0.5 font-inter-regular text-small ${done ? "text-web-ink-faint" : "text-web-ink-muted"}`}>
                  {done ? step.doneDetail : step.detail}
                </Text>
              </View>
            </Animated.View>
          );
        })}
      </View>
    </View>
  );
}
