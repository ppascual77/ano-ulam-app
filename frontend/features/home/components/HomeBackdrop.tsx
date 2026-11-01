import { memo } from "react";
import { View, useWindowDimensions } from "react-native";
import Svg, { Path } from "react-native-svg";
import { colors } from "@/frontend/constants/theme";

type HomeBackdropProps = {
  /** The status bar's height: the page scrolls under it, so the dark
   *  green's edge is measured from below it. */
  top: number;
};

// The dark green's edge, like Browse and Price Watch: one sweep, higher on
// the right, dipping deep towards the left (px below the status bar).
const DARK_EDGE_LEFT = 190;
const DARK_EDGE_RIGHT = 28;
// Where across the width (0 to 1) its two bends sit, and how far down from
// the nearer end each pulls.
const BENDS: [right: number, left: number] = [0.85, 0.45];
const PULL: [right: number, left: number] = [0, 30];
// Dark green above the content, shown when iOS bounces past the top.
const OVERSCROLL = 1000;

// Home's background, scrolling with the page: dark green behind the
// greeting and the top of the plan card, then the white page.
export const HomeBackdrop = memo(function HomeBackdrop({ top }: HomeBackdropProps) {
  const { width: w } = useWindowDimensions();
  const left = top + DARK_EDGE_LEFT;
  const right = top + DARK_EDGE_RIGHT;
  const h = left + PULL[1] + 4;
  const dark = `M0 0H${w}V${right}C${w * BENDS[0]} ${right + PULL[0]} ${w * BENDS[1]} ${left + PULL[1]} 0 ${left}Z`;

  return (
    <View pointerEvents="none" style={{ position: "absolute", left: 0, top: -OVERSCROLL, width: w, height: h + OVERSCROLL }}>
      <View className="bg-home-top" style={{ height: OVERSCROLL }} />
      <Svg width={w} height={h}>
        <Path d={dark} fill={colors.home.top} />
      </Svg>
    </View>
  );
});
