import { useEffect, useState } from "react";
import { Text, View } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, { useAnimatedStyle, useSharedValue } from "react-native-reanimated";
import { scheduleOnRN } from "react-native-worklets";
import { PRICE_MAX, PRICE_MIN, PRICE_STEP } from "../utils/filters";

const THUMB = 20;
const TRACK = 6;

type PriceRangeSliderProps = {
  value: [number, number];
  onChange: (value: [number, number]) => void;
};

// Two-thumb ₱ range slider (₱50–₱700, step ₱10). Thumbs can't cross (at
// least one step apart). Horizontal drags only, so it doesn't fight the
// bottom sheet or its scroll view.
export function PriceRangeSlider({ value, onChange }: PriceRangeSliderProps) {
  const [width, setWidth] = useState(0);
  const [shown, setShown] = useState(value);
  const lo = useSharedValue(value[0]);
  const hi = useSharedValue(value[1]);
  const start = useSharedValue(0);
  const span = PRICE_MAX - PRICE_MIN;
  // The thumbs travel the track minus one thumb width (centers stay inside).
  const travel = Math.max(1, width - THUMB);

  // Keyed on the numbers, not the array (callers often pass a new literal).
  const [valueLo, valueHi] = value;
  useEffect(() => {
    lo.value = valueLo;
    hi.value = valueHi;
    setShown([valueLo, valueHi]);
  }, [valueLo, valueHi, lo, hi]);

  const commit = (next: [number, number]) => {
    setShown(next);
    onChange(next);
  };

  const snap = (raw: number) => {
    "worklet";
    return Math.round(raw / PRICE_STEP) * PRICE_STEP;
  };

  const loGesture = Gesture.Pan()
    .activeOffsetX([-4, 4])
    .failOffsetY([-12, 12])
    .onBegin(() => {
      start.value = lo.value;
    })
    .onUpdate((e) => {
      const next = Math.min(Math.max(snap(start.value + (e.translationX / travel) * span), PRICE_MIN), hi.value - PRICE_STEP);
      if (next !== lo.value) {
        lo.value = next;
        scheduleOnRN(setShown, [next, hi.value] as [number, number]);
      }
    })
    .onEnd(() => {
      scheduleOnRN(commit, [lo.value, hi.value] as [number, number]);
    });

  const hiGesture = Gesture.Pan()
    .activeOffsetX([-4, 4])
    .failOffsetY([-12, 12])
    .onBegin(() => {
      start.value = hi.value;
    })
    .onUpdate((e) => {
      const next = Math.max(Math.min(snap(start.value + (e.translationX / travel) * span), PRICE_MAX), lo.value + PRICE_STEP);
      if (next !== hi.value) {
        hi.value = next;
        scheduleOnRN(setShown, [lo.value, next] as [number, number]);
      }
    })
    .onEnd(() => {
      scheduleOnRN(commit, [lo.value, hi.value] as [number, number]);
    });

  const toX = (v: number) => {
    "worklet";
    return ((v - PRICE_MIN) / span) * travel;
  };
  const loStyle = useAnimatedStyle(() => ({ transform: [{ translateX: toX(lo.value) }] }));
  const hiStyle = useAnimatedStyle(() => ({ transform: [{ translateX: toX(hi.value) }] }));
  const rangeStyle = useAnimatedStyle(() => ({ left: toX(lo.value) + THUMB / 2, width: toX(hi.value) - toX(lo.value) }));

  return (
    <View>
      <View className="mb-3 flex-row justify-between">
        <Text className="font-inter-semibold text-small text-web-ink-soft">₱{shown[0]}</Text>
        <Text className="font-inter-semibold text-small text-web-ink-soft">₱{shown[1]}</Text>
      </View>

      <View onLayout={(e) => setWidth(e.nativeEvent.layout.width)} style={{ height: THUMB }} className="justify-center">
        <View className="rounded-full bg-web-divider" style={{ height: TRACK, marginHorizontal: THUMB / 2 }} />
        <Animated.View className="absolute rounded-full bg-brand-green" style={[{ height: TRACK }, rangeStyle]} />
        {width > 0 && (
          <>
            <GestureDetector gesture={loGesture}>
              <Animated.View
                hitSlop={12}
                className="absolute left-0 rounded-full border-2 border-brand-green bg-white shadow-sm"
                style={[{ width: THUMB, height: THUMB }, loStyle]}
              />
            </GestureDetector>
            <GestureDetector gesture={hiGesture}>
              <Animated.View
                hitSlop={12}
                className="absolute left-0 rounded-full border-2 border-brand-green bg-white shadow-sm"
                style={[{ width: THUMB, height: THUMB }, hiStyle]}
              />
            </GestureDetector>
          </>
        )}
      </View>

      <View className="mt-1.5 flex-row justify-between">
        <Text className="font-inter-regular text-sub text-web-ink-muted">₱{PRICE_MIN}</Text>
        <Text className="font-inter-regular text-sub text-web-ink-muted">₱{PRICE_MAX}</Text>
      </View>
    </View>
  );
}
