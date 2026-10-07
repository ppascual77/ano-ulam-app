import { memo, useEffect } from "react";
import { View, useWindowDimensions } from "react-native";
import Svg, { Defs, Path, RadialGradient, Rect, Stop } from "react-native-svg";
import Animated, { Easing, cancelAnimation, useAnimatedStyle, useSharedValue, withRepeat, withTiming } from "react-native-reanimated";
import { colors } from "@/frontend/constants/theme";

// Full-screen "Surprise me" backdrop: a warm orange glow with soft white
// rays slowly turning around the screen's center, behind the reveal card.

const RAY_COUNT = 20; // light/clear pairs around the circle
const RAY_OPACITY = 0.08;
const TURN_MS = 30000; // one full turn
// Edges darkened a touch so the glow reads as coming from the center.
const VIGNETTE_OPACITY = 0.22;

function raysPath(size: number) {
  const c = size / 2;
  const step = (Math.PI * 2) / RAY_COUNT;
  let d = "";
  for (let i = 0; i < RAY_COUNT; i++) {
    const a0 = i * step;
    const a1 = a0 + step / 2;
    d += `M${c} ${c}L${c + Math.cos(a0) * c} ${c + Math.sin(a0) * c}L${c + Math.cos(a1) * c} ${c + Math.sin(a1) * c}Z`;
  }
  return d;
}

// Memoized (it takes no props): parent re-renders, like the confetti burst,
// never redraw the SVG layers or restart the rays.
export const SunburstBackdrop = memo(function SunburstBackdrop() {
  const { width, height } = useWindowDimensions();
  // The rays layer is a square big enough to cover the screen at any angle.
  const raysSize = Math.ceil(Math.hypot(width, height));
  const turn = useSharedValue(0);

  useEffect(() => {
    turn.value = withRepeat(withTiming(360, { duration: TURN_MS, easing: Easing.linear }), -1, false);
    return () => cancelAnimation(turn);
  }, []);

  const raysStyle = useAnimatedStyle(() => ({ transform: [{ rotate: `${turn.value}deg` }] }));

  return (
    <View pointerEvents="none" className="absolute inset-0 overflow-hidden">
      <Svg width={width} height={height} style={{ position: "absolute" }}>
        <Defs>
          <RadialGradient id="glow" cx="50%" cy="50%" r="70%">
            <Stop offset="0" stopColor={colors.brandOrange} />
            <Stop offset="0.55" stopColor={colors.accent} />
            <Stop offset="1" stopColor={colors.accent} />
          </RadialGradient>
        </Defs>
        <Rect width={width} height={height} fill="url(#glow)" />
      </Svg>

      <Animated.View
        style={[
          { position: "absolute", width: raysSize, height: raysSize, left: (width - raysSize) / 2, top: (height - raysSize) / 2 },
          raysStyle,
        ]}
      >
        <Svg width={raysSize} height={raysSize}>
          <Path d={raysPath(raysSize)} fill={colors.white} fillOpacity={RAY_OPACITY} />
        </Svg>
      </Animated.View>

      <Svg width={width} height={height} style={{ position: "absolute" }}>
        <Defs>
          <RadialGradient id="vignette" cx="50%" cy="50%" r="75%">
            <Stop offset="0.5" stopColor={colors.black} stopOpacity={0} />
            <Stop offset="1" stopColor={colors.black} stopOpacity={VIGNETTE_OPACITY} />
          </RadialGradient>
        </Defs>
        <Rect width={width} height={height} fill="url(#vignette)" />
      </Svg>
    </View>
  );
});
