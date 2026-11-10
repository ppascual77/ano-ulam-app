import { useEffect } from "react";
import Animated, {
  cancelAnimation,
  Easing,
  interpolate,
  Extrapolation,
  useAnimatedProps,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
  type SharedValue,
} from "react-native-reanimated";
import Svg, { Path } from "react-native-svg";
import { colors } from "@/frontend/constants/theme";

const AnimatedPath = Animated.createAnimatedComponent(Path);
const SIZE = 40;
// One steam line's length (its dash), drawn in as the page is pulled.
const STEAM = 14;
const STEAM_PATHS = ["M17 19c-3-4 3-6 0-10", "M24 19c-3-4 3-6 0-10", "M31 19c-3-4 3-6 0-10"];

function Steam({ d, index, pull }: { d: string; index: number; pull: SharedValue<number> }) {
  // The three lines draw in one after another over the pull.
  const props = useAnimatedProps(() => {
    const k = interpolate(pull.value, [0.25 + index * 0.2, 0.55 + index * 0.2], [0, 1], Extrapolation.CLAMP);
    return { strokeDashoffset: STEAM * (1 - k) };
  });
  return (
    <AnimatedPath
      d={d}
      stroke={colors.white}
      strokeWidth={2.6}
      strokeLinecap="round"
      fill="none"
      strokeDasharray={STEAM}
      animatedProps={props}
    />
  );
}

type PotRefreshDoodleProps = {
  /** 0 at rest, 1 at the refresh threshold (more past it). */
  pull: SharedValue<number>;
  refreshing: boolean;
  /** From the scroll content's top: sits in the space a pull reveals. */
  top: number;
};

// Browse's pull to refresh: a pot doodle above the header, fading in with
// its three steam lines drawing one by one as the page is pulled; while
// refreshing, it bobs gently. The native spinner is hidden (RefreshControl
// with a clear tint) and this shows in its place.
export function PotRefreshDoodle({ pull, refreshing, top }: PotRefreshDoodleProps) {
  const bob = useSharedValue(0);
  useEffect(() => {
    if (!refreshing) {
      cancelAnimation(bob);
      bob.value = withTiming(0, { duration: 150 });
      return;
    }
    bob.value = withRepeat(withTiming(1, { duration: 420, easing: Easing.inOut(Easing.sin) }), -1, true);
  }, [refreshing, bob]);

  const style = useAnimatedStyle(() => ({
    opacity: refreshing ? 1 : interpolate(pull.value, [0.1, 0.5], [0, 1], Extrapolation.CLAMP),
    transform: [{ translateY: -3 * bob.value }, { scale: refreshing ? 1 : interpolate(pull.value, [0, 1], [0.7, 1], Extrapolation.CLAMP) }],
  }));
  const steamPull = useSharedValue(0);
  // While refreshing the steam stays fully drawn.
  const drawn = refreshing ? steamPull : pull;
  useEffect(() => {
    steamPull.value = refreshing ? 1 : 0;
  }, [refreshing, steamPull]);

  return (
    <Animated.View pointerEvents="none" style={[{ position: "absolute", top, left: 0, right: 0, alignItems: "center" }, style]}>
      <Svg width={SIZE} height={SIZE} viewBox="0 0 48 48">
        <Path
          d="M6 26h36M9 26v8a6 6 0 0 0 6 6h18a6 6 0 0 0 6-6v-8"
          stroke={colors.white}
          strokeWidth={2.6}
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
        />
        {STEAM_PATHS.map((d, i) => (
          <Steam key={d} d={d} index={i} pull={drawn} />
        ))}
      </Svg>
    </Animated.View>
  );
}
