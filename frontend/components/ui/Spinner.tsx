import { useEffect } from "react";
import Animated, { Easing, useAnimatedStyle, useSharedValue, withRepeat, withTiming } from "react-native-reanimated";

type SpinnerProps = {
  /** Diameter in px. Defaults to 32 (the web app's page spinner, h-8 w-8). */
  size?: number;
  /** Ring thickness in px. Defaults to 2. */
  thickness?: number;
  /** The bright arc. Defaults to white (for dark backgrounds). */
  color?: string;
  /** The faint full ring behind it. Defaults to 20% white. */
  trackColor?: string;
};

// Ring spinner ported from the web app (`animate-spin rounded-full border-2
// border-white/20 border-t-white`): a faint track with one bright top arc,
// rotating. Used where the web uses it (Discover's loading screen, the
// like/save buttons) instead of the platform ActivityIndicator, which looks
// different on iOS and Android.
export function Spinner({ size = 32, thickness = 2, color = "#FFFFFF", trackColor = "rgba(255,255,255,0.2)" }: SpinnerProps) {
  const rotation = useSharedValue(0);

  useEffect(() => {
    rotation.value = withRepeat(withTiming(360, { duration: 1000, easing: Easing.linear }), -1, false);
  }, [rotation]);

  const style = useAnimatedStyle(() => ({ transform: [{ rotate: `${rotation.value}deg` }] }));

  return (
    <Animated.View
      accessibilityRole="progressbar"
      accessibilityLabel="Loading"
      style={[
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          borderWidth: thickness,
          borderColor: trackColor,
          borderTopColor: color,
        },
        style,
      ]}
    />
  );
}
