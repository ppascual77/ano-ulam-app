import { useEffect } from "react";
import { Pressable, View } from "react-native";
import Animated, { useAnimatedStyle, withTiming, useSharedValue } from "react-native-reanimated";
import { AppText } from "./AppText";
import { colors } from "@/frontend/constants/theme";

type ToggleProps = {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label?: string;
};

const TRACK_WIDTH = 44;
const TRACK_HEIGHT = 24;
const THUMB_SIZE = 16;
const THUMB_INSET = 4;

export function Toggle({ checked, onChange, label }: ToggleProps) {
  const progress = useSharedValue(checked ? 1 : 0);

  useEffect(() => {
    progress.value = withTiming(checked ? 1 : 0, { duration: 150 });
  }, [checked, progress]);

  const trackStyle = useAnimatedStyle(() => ({
    backgroundColor: progress.value ? colors.primary : colors.ink.subtle + "33",
  }));

  const thumbStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: progress.value * (TRACK_WIDTH - THUMB_SIZE - THUMB_INSET * 2) }],
  }));

  return (
    <View className="flex-row items-center gap-2">
      {label && (
        <AppText variant="caption" className="font-inter-medium">
          {label}
        </AppText>
      )}
      <Pressable onPress={() => onChange(!checked)}>
        <Animated.View
          style={[{ width: TRACK_WIDTH, height: TRACK_HEIGHT, borderRadius: TRACK_HEIGHT / 2, padding: THUMB_INSET }, trackStyle]}
        >
          <Animated.View
            style={[{ width: THUMB_SIZE, height: THUMB_SIZE, borderRadius: THUMB_SIZE / 2, backgroundColor: colors.white }, thumbStyle]}
          />
        </Animated.View>
      </Pressable>
    </View>
  );
}
