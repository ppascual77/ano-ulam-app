import { memo } from "react";
import { View, useWindowDimensions } from "react-native";
import Svg, { G, Path, Rect } from "react-native-svg";
import { HEADER_OVERSCROLL, HeaderTexture } from "@/frontend/components/ui";
import { colors } from "@/frontend/constants/theme";

type HomeBackdropProps = {
  /** The status bar's height: the page scrolls under it, so the dark
   *  green's edge is measured from below it. */
  top: number;
  /** Extra px the green reaches down (room for a line under the greeting). */
  extra?: number;
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
const OVERSCROLL = HEADER_OVERSCROLL;

/** Where the dark green's edge is highest (its right end), in the scroll
 *  content: the status bar strip stays clear above it. */
export const homeDarkEdgeTop = (top: number, extra = 0) => top + DARK_EDGE_RIGHT + extra;

// Home's background, scrolling with the page: dark green (with Browse's
// light and doodles) behind the greeting and the top of the plan card, then
// the white page.
export const HomeBackdrop = memo(function HomeBackdrop({ top, extra = 0 }: HomeBackdropProps) {
  const { width: w } = useWindowDimensions();
  const left = top + DARK_EDGE_LEFT + extra;
  const right = top + DARK_EDGE_RIGHT + extra;
  const h = left + PULL[1] + 4;
  const dark = `M0 0H${w}V${right}C${w * BENDS[0]} ${right + PULL[0]} ${w * BENDS[1]} ${left + PULL[1]} 0 ${left}Z`;

  return (
    <View pointerEvents="none" style={{ position: "absolute", left: 0, top: -OVERSCROLL, width: w, height: h + OVERSCROLL }}>
      {/* One drawing from the overscroll down, with Browse's texture (soft
          light, faint doodles) running up behind the status bar. */}
      <Svg width={w} height={h + OVERSCROLL}>
        <G transform={`translate(0 ${OVERSCROLL})`}>
          <Rect x={0} y={-OVERSCROLL} width={w} height={OVERSCROLL + 1} fill={colors.home.top} />
          <Path d={dark} fill={colors.home.top} />
          <HeaderTexture id="homeHeader" width={w} height={h} dark={dark} depth={(left + right) / 2} />
        </G>
      </Svg>
    </View>
  );
});
