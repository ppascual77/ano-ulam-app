import { useEffect } from "react";
import { Pressable, Text, View } from "react-native";
import Animated, { Easing, useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";
import { Check } from "lucide-react-native";
import { colors } from "@/frontend/constants/theme";

const FILL_MS = 320;
const EASE = Easing.out(Easing.cubic);

function Segment({
  label,
  state,
  canJump,
  onPress,
  reduceMotion,
}: {
  label: string;
  state: "done" | "current" | "todo";
  canJump: boolean;
  onPress: () => void;
  reduceMotion: boolean;
}) {
  const filled = state !== "todo";
  // Fills left to right as you advance into a step, empties when you go back.
  const fill = useSharedValue(filled ? 1 : 0);
  useEffect(() => {
    fill.value = reduceMotion ? (filled ? 1 : 0) : withTiming(filled ? 1 : 0, { duration: FILL_MS, easing: EASE });
  }, [filled, reduceMotion]);
  const fillStyle = useAnimatedStyle(() => ({ width: `${fill.value * 100}%` }));

  return (
    <Pressable
      onPress={onPress}
      disabled={!canJump}
      hitSlop={{ top: 10, bottom: 6 }}
      accessibilityRole="button"
      accessibilityLabel={`${label}${state === "done" ? ", done" : state === "current" ? ", current step" : ""}`}
      accessibilityState={{ disabled: !canJump, selected: state === "current" }}
      className="flex-1 gap-1.5"
    >
      <View className="h-1 overflow-hidden rounded-full bg-ink-emphasis/10">
        <Animated.View style={[{ height: "100%", backgroundColor: colors.primary, borderRadius: 999 }, fillStyle]} />
      </View>
      <View className="flex-row items-center gap-1">
        {state === "done" && <Check color={colors.primary} size={12} strokeWidth={3} />}
        <Text
          numberOfLines={1}
          className={`text-small ${
            state === "current"
              ? "font-inter-semibold text-ink-emphasis"
              : state === "done"
                ? "font-inter-medium text-primary"
                : "font-inter-regular text-ink-subtle"
          }`}
        >
          {label}
        </Text>
      </View>
    </Pressable>
  );
}

type StepProgressProps = {
  steps: string[];
  current: number;
  /** Whether a segment can be tapped to go there (finished steps). */
  canJumpTo: (index: number) => boolean;
  onJump: (index: number) => void;
  reduceMotion: boolean;
};

// One segment per step, filled up to the current one, with each step's
// name under it: finished ones in green with a check (tap to go back to
// them), the current one bold.
export function StepProgress({ steps, current, canJumpTo, onJump, reduceMotion }: StepProgressProps) {
  return (
    <View className="flex-row gap-2">
      {steps.map((step, i) => (
        <Segment
          key={step}
          label={step}
          state={i < current ? "done" : i === current ? "current" : "todo"}
          canJump={i !== current && canJumpTo(i)}
          onPress={() => onJump(i)}
          reduceMotion={reduceMotion}
        />
      ))}
    </View>
  );
}
