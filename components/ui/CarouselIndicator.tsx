import { useEffect } from "react";
import { View } from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  interpolate,
  interpolateColor,
} from "react-native-reanimated";
import { colors } from "@/constants/theme";

// Same color as bg-primary/20 — interpolateColor needs a literal color
// value, not a Tailwind opacity modifier.
const INACTIVE_COLOR = "rgba(40, 96, 70, 0.2)";

function Dot({ isActive }: { isActive: boolean }) {
  const progress = useSharedValue(isActive ? 1 : 0);

  useEffect(() => {
    progress.value = withTiming(isActive ? 1 : 0, { duration: 250 });
  }, [isActive, progress]);

  const style = useAnimatedStyle(() => ({
    width: interpolate(progress.value, [0, 1], [8, 24]),
    backgroundColor: interpolateColor(progress.value, [0, 1], [INACTIVE_COLOR, colors.primary]),
  }));

  return <Animated.View style={[{ height: 8, borderRadius: 999 }, style]} />;
}

type Props = {
  total: number;
  activeIndex: number;
};

export function CarouselIndicator({ total, activeIndex }: Props) {
  return (
    <View className="flex-row gap-2">
      {Array.from({ length: total }).map((_, i) => (
        <Dot key={i} isActive={i === activeIndex} />
      ))}
    </View>
  );
}
