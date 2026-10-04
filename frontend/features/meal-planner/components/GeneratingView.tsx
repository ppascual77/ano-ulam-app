import { useEffect, useState } from "react";
import { Pressable, Text, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import Animated, {
  Easing,
  FadeIn,
  FadeInDown,
  FadeInUp,
  FadeOutUp,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from "react-native-reanimated";
import { ArrowLeft, ArrowRight, Check } from "lucide-react-native";
import { Button, Spinner } from "@/frontend/components/ui";
import { colors } from "@/frontend/constants/theme";
import { Image } from "expo-image";

// Mock generation: a timed checklist (no backend wait), ~4s in total.
const STEP_MS = 650;
// Per-step length multiplier, by index: "Planning your 5 days" (the 4th)
// takes twice as long, like the heavy part of the work.
const STEP_DURATION_FACTOR: Record<number, number> = { 3: 2 };
// Done: old title out, new title in, then the button.
const TITLE_SWAP_MS = 300;
const BUTTON_DELAY_MS = TITLE_SWAP_MS * 2 + 150;

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

// The title with a soft light band sweeping across it on a loop. No text
// mask needed: the band is white, so over the white background it's
// invisible and over the dark letters it briefly brightens them.
const SHIMMER_MS = 1600;
const SHIMMER_WIDTH = 90;
const SHIMMER_BAND = ["rgba(255,255,255,0)", "rgba(255,255,255,0.75)", "rgba(255,255,255,0)"] as const;

function ShimmerTitle({ text }: { text: string }) {
  const [width, setWidth] = useState(0);
  const sweep = useSharedValue(0);
  useEffect(() => {
    if (width === 0) return;
    sweep.value = 0;
    sweep.value = withRepeat(withTiming(1, { duration: SHIMMER_MS, easing: Easing.inOut(Easing.quad) }), -1, false);
  }, [width]);
  const bandStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: -SHIMMER_WIDTH + (width + SHIMMER_WIDTH * 2) * sweep.value }],
  }));
  return (
    <View onLayout={(e) => setWidth(e.nativeEvent.layout.width)} className="overflow-hidden">
      <Text className="text-center font-inter-bold text-heading-lg text-web-ink">{text}</Text>
      <Animated.View pointerEvents="none" style={[{ position: "absolute", top: 0, bottom: 0, left: 0, width: SHIMMER_WIDTH }, bandStyle]}>
        <LinearGradient colors={SHIMMER_BAND} start={{ x: 0, y: 0.5 }} end={{ x: 1, y: 0.5 }} style={{ flex: 1 }} />
      </Animated.View>
    </View>
  );
}

// One soft ring that expands out from a check as it lands, then fades.
const PULSE_MS = 650;
const PULSE_SCALE = 2.4;

function DoneCheck() {
  const pulse = useSharedValue(0);
  useEffect(() => {
    pulse.value = withTiming(1, { duration: PULSE_MS, easing: Easing.out(Easing.quad) });
    // Once, when the step completes.
  }, []);
  const ringStyle = useAnimatedStyle(() => ({
    opacity: 0.45 * (1 - pulse.value),
    transform: [{ scale: 1 + (PULSE_SCALE - 1) * pulse.value }],
  }));
  return (
    <View className="h-5 w-5 items-center justify-center">
      <Animated.View pointerEvents="none" style={ringStyle} className="absolute h-5 w-5 rounded-full bg-brand-green" />
      <Animated.View entering={FadeIn.duration(200)} className="h-5 w-5 items-center justify-center rounded-full bg-brand-green">
        <Check color={colors.white} size={12} strokeWidth={3} />
      </Animated.View>
    </View>
  );
}

function StepIcon({ state }: { state: "pending" | "active" | "done" }) {
  if (state === "done") return <DoneCheck />;
  if (state === "active") return <Spinner size={20} thickness={2} color={colors.brandGreen.DEFAULT} trackColor={colors.webDivider} />;
  return <View className="h-5 w-5 rounded-full border-2 border-web-ink-faint" />;
}

type GeneratingViewProps = {
  budgetLabel: string;
  hasMacros: boolean;
  /** Back arrow: cancel and return to setup. */
  onBack: () => void;
  /** "See my meal plan", shown once every step is done. */
  onDone: () => void;
  /** No plan could be built: skip the success state and call onDone
   *  right away (the screen then shows the error). */
  failed?: boolean;
};

// "Planning your week...": the steps tick off one by one; then the title
// changes to "Your week is planned!" and a "See my meal plan" button fades
// in (which calls onDone).
export function GeneratingView({ budgetLabel, hasMacros, onBack, onDone, failed = false }: GeneratingViewProps) {
  const list = steps(budgetLabel, hasMacros);
  // Index of the step in progress; list.length = all done.
  const [active, setActive] = useState(0);
  const progress = useSharedValue(0);
  const doneCount = Math.min(active, list.length);
  const finished = active >= list.length && !failed;

  useEffect(() => {
    progress.value = withTiming(doneCount / list.length, { duration: 300 });
    if (active >= list.length) {
      if (!failed) return;
      const timer = setTimeout(onDone, 450);
      return () => clearTimeout(timer);
    }
    const timer = setTimeout(() => setActive((i) => i + 1), STEP_MS * (STEP_DURATION_FACTOR[active] ?? 1));
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
        <Image source={require("@/assets/onboarding/slide-2.gif")} style={{ width: 180, height: 178 }} contentFit="contain" />
      </View>

      <View className="mt-6 items-center">
        {/* The working title fades up and out; the done title fades up into
            its place right after. Fixed height so nothing jumps. */}
        <View className="h-9 items-center justify-center">
          {finished ? (
            <Animated.View key="done" entering={FadeInUp.delay(TITLE_SWAP_MS).duration(TITLE_SWAP_MS)}>
              <Text className="text-center font-inter-bold text-heading-lg text-primary">Your week is planned!</Text>
            </Animated.View>
          ) : (
            <Animated.View key="planning" exiting={FadeOutUp.duration(TITLE_SWAP_MS)}>
              <ShimmerTitle text="Planning your week..." />
            </Animated.View>
          )}
        </View>
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

      <View className="mx-7 mt-6 gap-4 pl-3">
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
                  className={`font-inter-medium text-subheading ${done ? "text-primary" : state === "active" ? "text-web-ink" : "text-web-ink-body"}`}
                >
                  {step.title}
                </Text>
                <Text className={`mt-0.5 font-inter-regular text-small ${done ? "text-primary/70" : "text-web-ink-muted"}`}>
                  {done ? step.doneDetail : step.detail}
                </Text>
              </View>
            </Animated.View>
          );
        })}
      </View>

      {finished && (
        <Animated.View entering={FadeInDown.delay(BUTTON_DELAY_MS).duration(350)} className="mx-7 mt-auto pb-14">
          <Button label="See my meal plan" icon={<ArrowRight color={colors.white} size={18} />} iconPosition="right" onPress={onDone} />
        </Animated.View>
      )}
    </View>
  );
}
