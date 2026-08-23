import { ReactNode, useEffect, useState } from "react";
import { Text, TextInput, TextInputProps, View } from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  interpolateColor,
  interpolate,
} from "react-native-reanimated";
import { colors } from "@/constants/theme";

type TextFieldProps = Omit<TextInputProps, "placeholder"> & {
  /** Floating label — shown centered as a placeholder, animates up/small once focused or filled. */
  label: string;
  icon?: ReactNode;
};

// No fill out of focus — just the border; focused fills white for contrast
// against the primary border.
const UNFOCUSED_BG = "rgba(0, 0, 0, 0)";
const UNFOCUSED_BORDER = "rgba(43, 52, 55, 0.1)";

export function TextField({ label, icon, value, onFocus, onBlur, className = "", ...props }: TextFieldProps) {
  const [isFocused, setIsFocused] = useState(false);
  const isFloating = isFocused || !!value;
  const progress = useSharedValue(isFloating ? 1 : 0);

  useEffect(() => {
    progress.value = withTiming(isFloating ? 1 : 0, { duration: 180 });
  }, [isFloating, progress]);

  const containerStyle = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(progress.value, [0, 1], [UNFOCUSED_BG, colors.white]),
    borderColor: interpolateColor(progress.value, [0, 1], [UNFOCUSED_BORDER, colors.primary]),
  }));

  const labelStyle = useAnimatedStyle(() => ({
    transform: [
      { translateY: interpolate(progress.value, [0, 1], [0, -12]) },
      { scale: interpolate(progress.value, [0, 1], [1, 0.72]) },
    ],
  }));

  return (
    <Animated.View
      style={[{ borderRadius: 16, borderWidth: 1, height: 55 }, containerStyle]}
      className={`flex-row items-center px-4 ${className}`}
    >
      {icon}
      <View className="ml-2 flex-1 justify-center" style={{ height: 44 }}>
        <Animated.View
          style={[
            { position: "absolute", left: 0, right: 0, transformOrigin: "left" },
            labelStyle,
          ]}
        >
          <Text
            numberOfLines={1}
            ellipsizeMode="tail"
            className="font-inter-medium text-body text-ink-subtle"
          >
            {label}
          </Text>
        </Animated.View>
        <TextInput
          value={value}
          onFocus={(e) => {
            setIsFocused(true);
            onFocus?.(e);
          }}
          onBlur={(e) => {
            setIsFocused(false);
            onBlur?.(e);
          }}
          className="font-inter-semibold text-subheading text-ink-emphasis"
          style={{ marginTop: isFloating ? 16 : 0, padding: 0 }}
          {...props}
        />
      </View>
    </Animated.View>
  );
}
