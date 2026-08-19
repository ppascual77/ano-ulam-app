import { forwardRef, useEffect, useImperativeHandle } from "react";
import { View, type DimensionValue } from "react-native";
import { Image } from "expo-image";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withSequence,
  withTiming,
  Easing,
} from "react-native-reanimated";

// Slow, constant-speed spin — linear easing so it doesn't visibly speed up
// or slow down at the start/end of each 360° cycle. A rotating shape (as
// opposed to the earlier linear back-and-forth) has no endpoint to look
// "cut off" at when it loops.
const ROTATION_DURATION_MS = 60000;

// A "pulse" briefly speeds the spin up (covers more degrees than the
// steady pace would in the same time), then falls back to steady rotation.
// Symmetric ease-in-out so the ramp up and back down both blend smoothly
// with the constant-speed rotation on either side, no visible snap.
const PULSE_BOOST_DEGREES = 40;
const PULSE_DURATION_MS = 500;
const PULSE_EASING = Easing.bezier(0.42, 0, 0.58, 1);

export type RotatingBlobHandle = {
  /** Briefly speeds up the rotation, then eases back to the normal pace. */
  pulse: () => void;
};

type Props = {
  source: number;
  /** width / height of the source PNG — pass its real ratio so contentFit="contain" doesn't letterbox it into a smaller shape than the box implies. */
  aspectRatio: number;
  height?: number;
  // Anchor with top+right (upper-right corner) or bottom+left (lower-left
  // corner) — pass the pair matching the corner you want.
  top?: DimensionValue;
  right?: number;
  bottom?: DimensionValue;
  left?: number;
};

export const RotatingBlob = forwardRef<RotatingBlobHandle, Props>(function RotatingBlob(
  { source, aspectRatio, height = 640, top, right, bottom, left }: Props,
  ref,
) {
  const width = height * aspectRatio;
  const rotation = useSharedValue(0);

  useEffect(() => {
    rotation.value = withRepeat(
      withTiming(360, { duration: ROTATION_DURATION_MS, easing: Easing.linear }),
      -1,
      false,
    );
  }, [rotation]);

  useImperativeHandle(ref, () => ({
    pulse: () => {
      const current = rotation.value;
      rotation.value = withSequence(
        withTiming(current + PULSE_BOOST_DEGREES, {
          duration: PULSE_DURATION_MS,
          easing: PULSE_EASING,
        }),
        withRepeat(
          withTiming(current + PULSE_BOOST_DEGREES + 360, {
            duration: ROTATION_DURATION_MS,
            easing: Easing.linear,
          }),
          -1,
          false,
        ),
      );
    },
  }));

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${rotation.value}deg` }],
  }));

  // Only fall back to a default top-right sliver if the caller didn't
  // explicitly opt into bottom-left anchoring instead.
  const usingBottomLeft = bottom !== undefined || left !== undefined;

  return (
    <View pointerEvents="none" className="absolute inset-0 overflow-hidden">
      <Animated.View
        style={[
          {
            position: "absolute",
            width,
            height,
            top: usingBottomLeft ? undefined : (top ?? "5%"),
            right: usingBottomLeft ? undefined : (right ?? -width + 120),
            bottom: usingBottomLeft ? (bottom ?? "5%") : undefined,
            left: usingBottomLeft ? (left ?? -width + 120) : undefined,
          },
          animatedStyle,
        ]}
      >
        <Image
          source={source}
          style={{ width, height, opacity: 0.17 }}
          contentFit="contain"
        />
      </Animated.View>
    </View>
  );
});
