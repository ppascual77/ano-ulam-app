import { useRef } from "react";
import { type StyleProp, Text, type TextStyle } from "react-native";
import Animated, { Easing, LayoutAnimationConfig, useSharedValue, withTiming } from "react-native-reanimated";

const ROLL_MS = 240;
// How far the text travels while it fades (px): a short roll, not a scroll.
const ROLL_DISTANCE = 12;
const ROLL_EASING = Easing.out(Easing.cubic);

type RollingTextProps = {
  value: string | number;
  /** Orders the values, so it rolls up when this goes up and down when it
   *  goes down (e.g. the servings count behind "Single Serve"). */
  rank: number;
  className?: string;
  style?: StyleProp<TextStyle>;
};

// Text that rolls when it changes, like a counter: the new value comes up
// from below (or down from above when `rank` drops) while the old one rolls
// out the other way. The first render just appears.
export function RollingText({ value, rank, className, style }: RollingTextProps) {
  // +1 rolling up, -1 rolling down. Set while rendering the new value, so
  // the entering/exiting worklets (which run after this commit) read it.
  const direction = useSharedValue(1);
  const lastRank = useRef(rank);
  if (rank !== lastRank.current) {
    direction.value = rank > lastRank.current ? 1 : -1;
    lastRank.current = rank;
  }

  const entering = () => {
    "worklet";
    const d = direction.value;
    return {
      initialValues: { opacity: 0, transform: [{ translateY: d * ROLL_DISTANCE }] },
      animations: {
        opacity: withTiming(1, { duration: ROLL_MS }),
        transform: [{ translateY: withTiming(0, { duration: ROLL_MS, easing: ROLL_EASING }) }],
      },
    };
  };
  const exiting = () => {
    "worklet";
    const d = direction.value;
    return {
      initialValues: { opacity: 1, transform: [{ translateY: 0 }] },
      animations: {
        opacity: withTiming(0, { duration: ROLL_MS }),
        transform: [{ translateY: withTiming(-d * ROLL_DISTANCE, { duration: ROLL_MS, easing: ROLL_EASING }) }],
      },
    };
  };

  // Keyed by value, so each change mounts a new one (entering) and unmounts
  // the old (exiting, kept in place while it rolls out). Plain Text inside
  // an Animated.View: NativeWind's className stays off the animated node.
  return (
    <LayoutAnimationConfig skipEntering>
      <Animated.View key={String(value)} entering={entering} exiting={exiting}>
        <Text className={className} style={style}>
          {value}
        </Text>
      </Animated.View>
    </LayoutAnimationConfig>
  );
}
