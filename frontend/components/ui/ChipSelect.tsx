import { useEffect } from "react";
import { View, Pressable } from "react-native";
import Animated, {
  FadeIn,
  FadeOut,
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  interpolateColor,
} from "react-native-reanimated";
import { X } from "lucide-react-native";
import { AppText } from "./AppText";
import { colors } from "@/frontend/constants/theme";

export type ChipOption = {
  id: string;
  label: string;
};

type ChipVariant = "default" | "segmented";

type ChipSelectProps = {
  options: ChipOption[];
  /** "single" toggles between one selection or none; "multi" allows any number, including none. */
  mode?: "single" | "multi";
  /** "default": rounded tag, light-gray/primary fill, no border (e.g. onboarding preference tags).
   *  "segmented": small bordered pill, primary/white swap (e.g. a Budget/Pantry mode switch). */
  variant?: ChipVariant;
  /** With mode="single", disallows deselecting down to none — one option is always selected. */
  required?: boolean;
  /** A quiet "Clear" after the chips while anything is selected, for
   *  choices where nothing selected is a real answer (e.g. no allergens). */
  clearable?: boolean;
  value: string[];
  onChange: (value: string[]) => void;
};

// Same color as bg-ink-emphasis/5 — interpolateColor needs a literal value.
const UNSELECTED_BG = "rgba(43, 52, 55, 0.05)";

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

function Chip({
  label,
  isSelected,
  variant,
  onPress,
}: {
  label: string;
  isSelected: boolean;
  variant: ChipVariant;
  onPress: () => void;
}) {
  const progress = useSharedValue(isSelected ? 1 : 0);

  useEffect(() => {
    progress.value = withTiming(isSelected ? 1 : 0, { duration: 200 });
  }, [isSelected, progress]);

  const unselectedBg = variant === "segmented" ? colors.white : UNSELECTED_BG;
  const unselectedText = variant === "segmented" ? "text-primary" : "text-ink";

  const animatedStyle = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(progress.value, [0, 1], [unselectedBg, colors.primary]),
  }));

  return (
    <AnimatedPressable
      onPress={onPress}
      style={[
        {
          borderRadius: variant === "segmented" ? 20 : 999,
          paddingHorizontal: 20,
          paddingVertical: variant === "segmented" ? 4 : 10,
          borderWidth: variant === "segmented" ? 1 : 0,
          borderColor: colors.primary,
        },
        animatedStyle,
      ]}
    >
      <AppText variant="bodyMedium" className={isSelected ? "text-white" : unselectedText}>
        {label}
      </AppText>
    </AnimatedPressable>
  );
}

export function ChipSelect({
  options,
  mode = "multi",
  variant = "default",
  required = false,
  clearable = false,
  value,
  onChange,
}: ChipSelectProps) {
  // Only what's still an option counts (a stored value no longer offered
  // shouldn't keep Clear showing).
  const hasSelection = value.some((id) => options.some((option) => option.id === id));
  const toggle = (id: string) => {
    const isSelected = value.includes(id);
    if (mode === "single") {
      if (isSelected && required) return;
      onChange(isSelected ? [] : [id]);
      return;
    }
    onChange(isSelected ? value.filter((v) => v !== id) : [...value, id]);
  };

  return (
    <View className="flex-row flex-wrap gap-3">
      {options.map((option) => (
        <Chip
          key={option.id}
          label={option.label}
          isSelected={value.includes(option.id)}
          variant={variant}
          onPress={() => toggle(option.id)}
        />
      ))}
      {clearable && hasSelection && (
        <Animated.View entering={FadeIn.duration(180)} exiting={FadeOut.duration(140)}>
          {/* Chip height (10px padding + one line), so it sits on the row. */}
          <Pressable
            onPress={() => onChange([])}
            accessibilityRole="button"
            accessibilityLabel="Clear selection"
            hitSlop={6}
            className="flex-row items-center gap-1 px-2 py-2.5 active:opacity-60"
          >
            <X color={colors.ink.subtle} size={14} strokeWidth={2.5} />
            <AppText variant="bodyMedium" className="text-ink-subtle">
              Clear
            </AppText>
          </Pressable>
        </Animated.View>
      )}
    </View>
  );
}
