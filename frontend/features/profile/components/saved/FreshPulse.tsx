import { ReactNode, useEffect } from "react";
import { View } from "react-native";
import Animated, { useAnimatedStyle, useSharedValue, withDelay, withSequence, withTiming } from "react-native-reanimated";
import { scheduleOnRN } from "react-native-worklets";
import { useReduceMotion } from "@/frontend/core/preferences/store/useReduceMotionStore";

const DELAY_MS = 250;

// The meal just saved, the first time the Saved tab shows it: one gentle
// swell with an orange ring that fades out (the Profile dot's color, so the
// dot and the card read as the same thing). With Reduce motion on, just the
// ring. Calls onDone once finished.
export function FreshPulse({ active, onDone, children }: { active: boolean; onDone: () => void; children: ReactNode }) {
  const reduceMotion = useReduceMotion();
  const scale = useSharedValue(1);
  const ring = useSharedValue(0);

  useEffect(() => {
    if (!active) return;
    if (!reduceMotion) {
      scale.value = withDelay(DELAY_MS, withSequence(withTiming(1.04, { duration: 220 }), withTiming(1, { duration: 320 })));
    }
    ring.value = withDelay(
      DELAY_MS,
      withSequence(
        withTiming(1, { duration: 220 }),
        withDelay(500, withTiming(0, { duration: 600 }, (done) => {
          if (done) scheduleOnRN(onDone);
        })),
      ),
    );
  }, [active]);

  const scaleStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  const ringStyle = useAnimatedStyle(() => ({ opacity: ring.value }));

  return (
    <Animated.View style={scaleStyle}>
      {children}
      <Animated.View pointerEvents="none" style={[{ position: "absolute", top: 0, right: 0, bottom: 0, left: 0 }, ringStyle]}>
        <View className="flex-1 rounded-2xl border-2 border-accent" />
      </Animated.View>
    </Animated.View>
  );
}
