import { useEffect, useRef } from "react";
import { View } from "react-native";
import { Image } from "expo-image";
import Animated, { Easing, Extrapolation, interpolate, useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";
import { scheduleOnRN } from "react-native-worklets";
import { colors } from "@/frontend/constants/theme";
import { useReduceMotion } from "@/frontend/core/preferences/store/useReduceMotionStore";
import { finishSaveFlight, useSaveFeedbackStore } from "../store/useSaveFeedbackStore";

// The save flight: the meal's photo lifts off the bookmark that was tapped,
// arcs up and over, then drops into the Profile tab, shrinking until it
// lands as the avatar's orange dot (which takes over the moment it lands,
// see finishSaveFlight). Mount once at the app root, above the navigator.
//
//   0–15%    lifts off: grows from 60% to full size, rising
//   15–100%  drops toward the dot, shrinking to the dot's size; the photo
//            tints orange over the last stretch so it lands as the dot
const FLY_MS = 560;
const THUMB = 32;
const DOT = 10;
// How far above the higher end the arc's peak sits.
const LIFT = 70;

export function SaveFeedbackLayer() {
  const reduceMotion = useReduceMotion();
  useEffect(() => {
    useSaveFeedbackStore.setState({ reduceMotion });
  }, [reduceMotion]);

  const flight = useSaveFeedbackStore((s) => s.flight);
  const rootRef = useRef<View>(null);
  const progress = useSharedValue(0);
  const shown = useSharedValue(0);
  const fromX = useSharedValue(0);
  const fromY = useSharedValue(0);
  const toX = useSharedValue(0);
  const toY = useSharedValue(0);

  useEffect(() => {
    if (!flight) {
      shown.value = 0;
      return;
    }
    // Window coordinates, made relative to this layer (the app can be
    // letterboxed on iPad).
    rootRef.current?.measureInWindow((ox, oy) => {
      fromX.value = flight.from.x - ox;
      fromY.value = flight.from.y - oy;
      toX.value = flight.to.x - ox;
      toY.value = flight.to.y - oy;
      progress.value = 0;
      shown.value = 1;
      progress.value = withTiming(1, { duration: FLY_MS, easing: Easing.inOut(Easing.cubic) }, (done) => {
        if (done) scheduleOnRN(finishSaveFlight, flight.id);
      });
    });
  }, [flight]);

  const thumbStyle = useAnimatedStyle(() => {
    const t = progress.value;
    // Quadratic curve through a peak above both ends, nudged toward the
    // start so it reads as "lift off, then drop in".
    const cx = fromX.value + (toX.value - fromX.value) * 0.3;
    const cy = Math.min(fromY.value, toY.value) - LIFT;
    const x = (1 - t) * (1 - t) * fromX.value + 2 * (1 - t) * t * cx + t * t * toX.value;
    const y = (1 - t) * (1 - t) * fromY.value + 2 * (1 - t) * t * cy + t * t * toY.value;
    const scale = interpolate(t, [0, 0.15, 1], [0.6, 1, DOT / THUMB]);
    return {
      opacity: shown.value,
      transform: [{ translateX: x - THUMB / 2 }, { translateY: y - THUMB / 2 }, { scale }],
    };
  });

  // The photo turns into the orange dot over the last stretch.
  const tintStyle = useAnimatedStyle(() => ({ opacity: interpolate(progress.value, [0.65, 0.95], [0, 1], Extrapolation.CLAMP) }));

  return (
    <View ref={rootRef} collapsable={false} pointerEvents="none" style={{ position: "absolute", top: 0, right: 0, bottom: 0, left: 0, zIndex: 100 }}>
      {flight && (
        // Plain style on the Animated.Views, className on the inner View:
        // NativeWind can knock out Reanimated's animated values.
        <Animated.View style={[{ position: "absolute", left: 0, top: 0, width: THUMB, height: THUMB }, thumbStyle]}>
          <View className="flex-1 overflow-hidden rounded-full border-2 border-white bg-accent shadow-lg">
            <Image source={flight.image} style={{ width: "100%", height: "100%" }} contentFit="cover" />
            <Animated.View style={[{ position: "absolute", top: 0, right: 0, bottom: 0, left: 0, backgroundColor: colors.accent }, tintStyle]} />
          </View>
        </Animated.View>
      )}
    </View>
  );
}
