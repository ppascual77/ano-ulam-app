import { useEffect, useState } from "react";
import Animated, { Easing, useAnimatedStyle, useSharedValue, withRepeat, withTiming } from "react-native-reanimated";
import { BoilingDoodle, DOODLES, drawBoilPair } from "./doodles";

type SpinnerProps = {
  /** "ring" (default) is the web app's spinner; "spiral" is the hand-drawn
   *  spiral doodle from Confetti, spinning (e.g. the meal detail's Save). */
  variant?: "ring" | "spiral";
  /** Diameter in px. Defaults to 32 (the web app's page spinner, h-8 w-8). */
  size?: number;
  /** Ring thickness in px. Defaults to 2. Ring only. */
  thickness?: number;
  /** The bright arc (ring) or the doodle's stroke (spiral). Defaults to white
   *  (for dark backgrounds). */
  color?: string;
  /** The faint full ring behind it. Defaults to 20% white. Ring only. */
  trackColor?: string;
};

function useSpin(durationMs: number) {
  const rotation = useSharedValue(0);

  useEffect(() => {
    rotation.value = withRepeat(withTiming(360, { duration: durationMs, easing: Easing.linear }), -1, false);
  }, [rotation, durationMs]);

  return useAnimatedStyle(() => ({ transform: [{ rotate: `${rotation.value}deg` }] }));
}

export function Spinner({ variant = "ring", ...props }: SpinnerProps) {
  return variant === "spiral" ? <SpiralSpinner {...props} /> : <RingSpinner {...props} />;
}

// Ring spinner ported from the web app (`animate-spin rounded-full border-2
// border-white/20 border-t-white`): a faint track with one bright top arc,
// rotating. Used where the web uses it (Discover's loading screen, the
// like/save buttons) instead of the platform ActivityIndicator, which looks
// different on iOS and Android.
function RingSpinner({ size = 32, thickness = 2, color = "#FFFFFF", trackColor = "rgba(255,255,255,0.2)" }: SpinnerProps) {
  const style = useSpin(1000);

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

// Thinner than the confetti doodles' 2.4 (viewBox units), so the spinner
// reads lighter inside buttons and inputs.
const SPIRAL_STROKE_WIDTH = 1.7;

// The spiral doodle spinning, with the same two-version "line boil" as the
// confetti pieces so it reads as hand-drawn.
function SpiralSpinner({ size = 32, color = "#FFFFFF" }: SpinnerProps) {
  const spin = useSpin(900);
  const [versions] = useState(() => drawBoilPair(DOODLES.spiral));

  return (
    <Animated.View accessibilityRole="progressbar" accessibilityLabel="Loading" style={spin}>
      <BoilingDoodle versions={versions} size={size} color={color} strokeWidth={SPIRAL_STROKE_WIDTH} />
    </Animated.View>
  );
}
