import { useEffect } from "react";
import { Pressable, Text } from "react-native";
import Animated, { Easing, useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";
import { Plus } from "lucide-react-native";
import { colors } from "@/frontend/constants/theme";

// Width of the "Create" label area when expanded (the + circle is separate).
const LABEL_WIDTH = 64;

// dark: glass over the Recipes reel. light: solid brand green on Community.
const variantClass = {
  dark: "border border-white/20 bg-white/15",
  light: "bg-brand-green",
} as const;

type CreateButtonProps = {
  expanded: boolean;
  onPress: () => void;
  variant: keyof typeof variantClass;
};

// 44px pill. Collapsed: a + circle. Expanded: "Create" slides/fades in to
// the left of the +. The screen owns the two-tap behavior (1st tap expands,
// 2nd collapses and opens the Create sheet).
export function CreateButton({ expanded, onPress, variant }: CreateButtonProps) {
  const progress = useSharedValue(expanded ? 1 : 0);

  useEffect(() => {
    progress.value = withTiming(expanded ? 1 : 0, { duration: 300, easing: Easing.out(Easing.cubic) });
  }, [expanded, progress]);

  const labelStyle = useAnimatedStyle(() => ({
    width: LABEL_WIDTH * progress.value,
    opacity: progress.value,
  }));

  return (
    <Pressable
      onPress={onPress}
      accessibilityLabel="Create"
      className={`h-11 flex-row items-center overflow-hidden rounded-full ${variantClass[variant]}`}
    >
      <Animated.View style={labelStyle} className="items-end overflow-hidden">
        <Text numberOfLines={1} className="pl-4 font-inter-medium text-body text-white">
          Create
        </Text>
      </Animated.View>
      <Animated.View className="h-11 w-11 items-center justify-center">
        <Plus color={colors.white} size={20} />
      </Animated.View>
    </Pressable>
  );
}
