import { useEffect, useState } from "react";
import { Image, Text, View } from "react-native";
import Animated, { FadeInDown, ZoomIn, useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";
import { Check } from "lucide-react-native";
import { Spinner } from "@/frontend/components/ui";
import { colors } from "@/frontend/constants/theme";
import { ImagePlaceholder } from "./ImagePlaceholder";

// Mock generation: a timed checklist (no backend wait), ~3.3s in total.
const STEP_MS = 650;

type Step = { title: string; detail: string };

function steps(budgetLabel: string, hasMacros: boolean): Step[] {
  return [
    { title: "Checking your budget", detail: `Finding meals within ${budgetLabel}` },
    { title: "Matching meals to your preferences", detail: "Considering your choices" },
    hasMacros
      ? { title: "Balancing your calories & macros", detail: "Making sure it fits your goals" }
      : { title: "Balancing your meals", detail: "Keeping each day filling and varied" },
    { title: "Planning your 5 days", detail: "Picking the best meal combinations" },
    { title: "Building your meal plan", detail: "Putting everything together" },
  ];
}

function StepIcon({ state }: { state: "pending" | "active" | "done" }) {
  if (state === "done") {
    return (
      <Animated.View entering={ZoomIn.springify().damping(12)} className="h-6 w-6 items-center justify-center rounded-full bg-brand-green">
        <Check color={colors.white} size={14} strokeWidth={3} />
      </Animated.View>
    );
  }
  if (state === "active") return <Spinner size={24} thickness={2.5} color={colors.brandGreen.DEFAULT} trackColor={colors.webDivider} />;
  return <View className="h-6 w-6 rounded-full border-2 border-web-divider" />;
}

type GeneratingViewProps = {
  budgetLabel: string;
  hasMacros: boolean;
  /** After the last step completes. */
  onDone: () => void;
};

// "Planning your week...": the steps tick off one by one, then onDone.
export function GeneratingView({ budgetLabel, hasMacros, onDone }: GeneratingViewProps) {
  const list = steps(budgetLabel, hasMacros);
  // Index of the step in progress; list.length = all done.
  const [active, setActive] = useState(0);
  const progress = useSharedValue(0);

  useEffect(() => {
    progress.value = withTiming(Math.min(1, (active + 1) / list.length), { duration: STEP_MS });
    if (active >= list.length) {
      const timer = setTimeout(onDone, 350);
      return () => clearTimeout(timer);
    }
    const timer = setTimeout(() => setActive((i) => i + 1), STEP_MS);
    return () => clearTimeout(timer);
  }, [active]);

  const barStyle = useAnimatedStyle(() => ({ width: `${progress.value * 100}%` }));

  return (
    <View className="flex-1 px-6 pt-4">
      <View className="items-center">
        <Image source={require("@/assets/icon.png")} className="h-9 w-9 rounded-full" />
      </View>

      <View className="mt-6 items-center">
        <Text className="text-center font-inter-bold text-heading text-web-ink">Planning your week...</Text>
        <Text className="mt-2 text-center font-inter-regular text-body text-web-ink-muted">
          Finding the best meals for your budget, preferences, and nutrition goals.
        </Text>
      </View>

      <View className="mt-6">
        <ImagePlaceholder kind="hero" height={150} />
      </View>

      <View className="mt-6 h-1.5 overflow-hidden rounded-full bg-web-divider">
        <Animated.View style={barStyle} className="h-full rounded-full bg-brand-green" />
      </View>

      <View className="mt-6 gap-4">
        {list.map((step, i) => {
          const state = i < active ? "done" : i === active ? "active" : "pending";
          return (
            <Animated.View
              key={step.title}
              entering={FadeInDown.delay(i * 60).duration(250)}
              className={`flex-row items-start gap-3 ${state === "pending" ? "opacity-50" : ""}`}
            >
              <StepIcon state={state} />
              <View className="flex-1">
                <Text className="font-inter-semibold text-body text-web-ink">{step.title}</Text>
                <Text className="mt-0.5 font-inter-regular text-small text-web-ink-muted">{step.detail}</Text>
              </View>
            </Animated.View>
          );
        })}
      </View>
    </View>
  );
}
