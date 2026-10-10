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

const LAP_MS = 750;
const FADE_MS = 300;
const STROKE = 2;

type BorderLapProps = {
  /** The round button's size; the lap runs along its own border. */
  size: number;
  /** Bump to run a lap. 0 renders nothing. */
  runId: number;
  /** Before the lap starts, in ms. */
  delay?: number;
};

// One lap of orange along a round button's border, drawn from the top,
// clockwise, then faded out.
export function BorderLap({ size, runId, delay = 0 }: BorderLapProps) {
  const radius = (size - STROKE) / 2;
  const circumference = 2 * Math.PI * radius;
  const lap = useSharedValue(0);
  const fade = useSharedValue(0);

  useEffect(() => {
    if (runId === 0) return;
    lap.value = 0;
    fade.value = 1;
    lap.value = withDelay(delay, withTiming(1, { duration: LAP_MS, easing: Easing.inOut(Easing.quad) }));
    fade.value = withSequence(withTiming(1, { duration: 0 }), withDelay(delay + LAP_MS, withTiming(0, { duration: FADE_MS })));
  }, [runId, delay, lap, fade]);

  const ringProps = useAnimatedProps(() => ({ strokeDashoffset: circumference * (1 - lap.value) }));
  const fadeStyle = useAnimatedStyle(() => ({ opacity: fade.value }));

  if (runId === 0) return null;

  // SVG draws from 3 o'clock, so it's turned back a quarter to start at the top.
  return (
    <Animated.View pointerEvents="none" style={[{ position: "absolute", left: 0, top: 0, width: size, height: size }, fadeStyle]}>
      <View style={{ transform: [{ rotate: "-90deg" }] }}>
        <Svg width={size} height={size}>
          <AnimatedCircle
            cx={size / 2}
            cy={size / 2}
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
    </Animated.View>
  );
}
