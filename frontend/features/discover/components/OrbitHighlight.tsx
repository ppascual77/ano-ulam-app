import { useEffect } from "react";
import { View } from "react-native";
import Animated, {
  Easing,
  useAnimatedProps,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSequence,
  withTiming,
} from "react-native-reanimated";
import Svg, { Circle } from "react-native-svg";
import { colors } from "@/frontend/constants/theme";

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

const ORBIT_MS = 750;
const FADE_MS = 300;
const STROKE = 2;
// The dot riding the ring.
export const ORBIT_DOT = 8;
// The ring sits this far outside the button, so its top is GAP above the
// button's top edge: where the intro's landing spot goes.
export const ORBIT_GAP = 3;
const GAP = ORBIT_GAP;

type OrbitHighlightProps = {
  /** The circle being highlighted (e.g. the 44px Create button). */
  size: number;
  /** Bump to run a lap. 0 renders nothing. */
  runId: number;
};

// One lap of an orange dot around a round button, drawing a ring behind it
// as it goes (starting and ending at the top), then both fade out. Discover's
// intro dot lands at the top of the ring (see ORBIT_GAP) and hands over to
// this.
export function OrbitHighlight({ size, runId }: OrbitHighlightProps) {
  const radius = size / 2 + GAP;
  const box = 2 * radius + ORBIT_DOT;
  const circumference = 2 * Math.PI * radius;
  const lap = useSharedValue(0);
  const fade = useSharedValue(0);

  useEffect(() => {
    if (runId === 0) return;
    lap.value = 0;
    fade.value = 1;
    lap.value = withTiming(1, { duration: ORBIT_MS, easing: Easing.inOut(Easing.quad) });
    fade.value = withSequence(withTiming(1, { duration: 0 }), withDelay(ORBIT_MS, withTiming(0, { duration: FADE_MS })));
  }, [runId, lap, fade]);

  // Drawn from 3 o'clock (SVG's start), so the Svg is turned back a quarter
  // to start at the top.
  const ringProps = useAnimatedProps(() => ({ strokeDashoffset: circumference * (1 - lap.value) }));
  const dotStyle = useAnimatedStyle(() => {
    const angle = -Math.PI / 2 + 2 * Math.PI * lap.value;
    return {
      transform: [
        { translateX: box / 2 + radius * Math.cos(angle) - ORBIT_DOT / 2 },
        { translateY: box / 2 + radius * Math.sin(angle) - ORBIT_DOT / 2 },
      ],
    };
  });
  const fadeStyle = useAnimatedStyle(() => ({ opacity: fade.value }));

  if (runId === 0) return null;

  return (
    <Animated.View
      pointerEvents="none"
      style={[{ position: "absolute", width: box, height: box, left: (size - box) / 2, top: (size - box) / 2 }, fadeStyle]}
    >
      <View style={{ position: "absolute", width: box, height: box, transform: [{ rotate: "-90deg" }] }}>
        <Svg width={box} height={box}>
          <AnimatedCircle
            cx={box / 2}
            cy={box / 2}
            r={radius}
            stroke={colors.accent}
            strokeWidth={STROKE}
            strokeLinecap="round"
            fill="none"
            strokeDasharray={`${circumference} ${circumference}`}
            animatedProps={ringProps}
          />
        </Svg>
      </View>
      <Animated.View
        className="rounded-full bg-accent"
        style={[{ position: "absolute", left: 0, top: 0, width: ORBIT_DOT, height: ORBIT_DOT }, dotStyle]}
      />
    </Animated.View>
  );
}
