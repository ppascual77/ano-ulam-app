import { useEffect } from "react";
import { View } from "react-native";
import Animated, { useAnimatedStyle, useSharedValue, withRepeat, withTiming } from "react-native-reanimated";

// Pulsing placeholder in the shape of a FoodPostCard, while posts load
// (Community feed, Profile's Food Posts).
export function PostSkeleton() {
  const pulse = useSharedValue(0.6);
  useEffect(() => {
    pulse.value = withRepeat(withTiming(1, { duration: 700 }), -1, true);
  }, [pulse]);
  const style = useAnimatedStyle(() => ({ opacity: pulse.value }));

  return (
    <Animated.View style={style} className="border-b border-web-divider pb-4">
      <View className="flex-row items-center gap-2.5 px-4 pt-4">
        <View className="h-8 w-8 rounded-full bg-web-divider" />
        <View className="h-3.5 w-28 rounded bg-web-divider" />
      </View>
      <View className="mx-4 mt-3 h-3 rounded bg-web-divider" />
      <View className="mx-4 mt-2 h-3 w-2/3 rounded bg-web-divider" />
      <View className="mt-3 w-full bg-web-divider" style={{ aspectRatio: 16 / 9 }} />
    </Animated.View>
  );
}
