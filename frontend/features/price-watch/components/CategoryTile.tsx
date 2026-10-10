import { useEffect, useRef } from "react";
import { Pressable } from "react-native";
import { Image } from "expo-image";
import Animated, {
  interpolateColor,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import { colors } from "@/frontend/constants/theme";
import type { PriceWatchCategory } from "../constants/categories";

// Selected = green outline only (no fill), cross-faded from the idle outline.
const TRANSITION_MS = 220;
// Same color as border-ink-emphasis/10: interpolateColor needs a literal
// color value, not a Tailwind opacity modifier.
const IDLE_BORDER = "rgba(43, 52, 55, 0.1)";
// The tile just selected dips and springs back.
const POP_SCALE = 0.94;
const POP_SPRING = { damping: 9, stiffness: 260, mass: 0.6 };

type CategoryTileProps = {
  category: PriceWatchCategory;
  selected: boolean;
  onPress: () => void;
};

export function CategoryTile({ category, selected, onPress }: CategoryTileProps) {
  const progress = useSharedValue(selected ? 1 : 0);
  const pop = useSharedValue(1);
  const mounted = useRef(false);

  useEffect(() => {
    progress.value = withTiming(selected ? 1 : 0, { duration: TRANSITION_MS });
    if (!mounted.current) {
      mounted.current = true;
      return;
    }
    if (selected) pop.value = withSequence(withTiming(POP_SCALE, { duration: 80 }), withSpring(1, POP_SPRING));
  }, [selected, progress, pop]);

  const tileStyle = useAnimatedStyle(() => ({
    borderColor: interpolateColor(progress.value, [0, 1], [IDLE_BORDER, colors.primary]),
    transform: [{ scale: pop.value }],
  }));
  const labelStyle = useAnimatedStyle(() => ({
    color: interpolateColor(progress.value, [0, 1], [colors.ink.emphasis, colors.primary]),
  }));

  // Plain styles on the Animated nodes (NativeWind can knock out Reanimated's
  // animated values); the label's className sets only font and size.
  return (
    <Animated.View style={[{ width: "23%", borderWidth: 1, borderRadius: 16, backgroundColor: colors.white }, tileStyle]}>
      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        accessibilityState={{ selected }}
        accessibilityLabel={`${category.label} category`}
        className="items-center gap-1 py-3"
      >
        <Image source={category.icon} style={{ width: 40, height: 40 }} contentFit="contain" />
        <Animated.Text style={labelStyle} className="font-inter-regular text-body leading-5">
          {category.label}
        </Animated.Text>
      </Pressable>
    </Animated.View>
  );
}
