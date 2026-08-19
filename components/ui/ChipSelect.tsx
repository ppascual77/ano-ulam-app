import { useEffect } from "react";
import { View, Pressable } from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  interpolateColor,
} from "react-native-reanimated";
import { AppText } from "./AppText";
import { colors } from "@/constants/theme";

export type ChipOption = {
  id: string;
  label: string;
};

type ChipSelectProps = {
  options: ChipOption[];
  /** "single" toggles between one selection or none; "multi" allows any number, including none. */
  mode?: "single" | "multi";
  value: string[];
  onChange: (value: string[]) => void;
};

// Same color as bg-ink-emphasis/5 — interpolateColor needs a literal value.
const UNSELECTED_BG = "rgba(43, 52, 55, 0.05)";

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

function Chip({
  label,
  isSelected,
  onPress,
}: {
  label: string;
  isSelected: boolean;
  onPress: () => void;
}) {
  const progress = useSharedValue(isSelected ? 1 : 0);

  useEffect(() => {
    progress.value = withTiming(isSelected ? 1 : 0, { duration: 200 });
  }, [isSelected, progress]);

  const animatedStyle = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(progress.value, [0, 1], [UNSELECTED_BG, colors.primary]),
  }));

  return (
    <AnimatedPressable
      onPress={onPress}
      style={[{ borderRadius: 999, paddingHorizontal: 16, paddingVertical: 8 }, animatedStyle]}
    >
      <AppText variant="bodyMedium" className={isSelected ? "text-white" : "text-ink"}>
        {label}
      </AppText>
    </AnimatedPressable>
  );
}

export function ChipSelect({ options, mode = "multi", value, onChange }: ChipSelectProps) {
  const toggle = (id: string) => {
    const isSelected = value.includes(id);
    if (mode === "single") {
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
          onPress={() => toggle(option.id)}
        />
      ))}
    </View>
  );
}
