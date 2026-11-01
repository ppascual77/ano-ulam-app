import { memo, useCallback, useState } from "react";
import { View, useWindowDimensions } from "react-native";
import { useFocusEffect } from "expo-router";
import Svg, { Path } from "react-native-svg";
import { colors } from "@/frontend/constants/theme";

// One screen's curves (px). The dark edge is measured from `splitAt` of the
// way down to `bottom`; the pale edge (no pale layer without it) from
// `bottom` itself.
export type HeaderCurves = {
  splitAt: number;
  dark: Edge;
  pale?: Edge;
};

// One smooth sweep: its two ends, where across the width (0 to 1) its two
// bends sit (right one first), and how far down from the nearer end each
// bend pulls (negative: up).
type Edge = { left: number; right: number; bends: Pair; pull: Pair };

type Pair = [right: number, left: number];

type HeaderBackdropProps = {
  /** Where the header's content ends (in the scroll content), e.g. Browse's
   *  search row: the green covers everything above it. */
  bottom: number | null;
  curves: HeaderCurves;
};

// Before the content's first layout: about where it ends.
const DEFAULT_BOTTOM = 190;
// A little variation per visit: ends move up to this many px either way,
// the bends up to this share of the width.
const NUDGE_Y = 6;
const NUDGE_X = 0.06;
// The pale layer, see-through over the white page.
const PALE_OPACITY = 0.3;
// Dark green above the content, shown when iOS bounces past the top.
const OVERSCROLL = 1000;

const nudge = (amount: number) => (Math.random() * 2 - 1) * amount;

const randomNudges = () => ({
  darkL: nudge(NUDGE_Y),
  darkR: nudge(NUDGE_Y),
  darkBend: nudge(NUDGE_X),
  paleL: nudge(NUDGE_Y),
  paleR: nudge(NUDGE_Y),
  paleBend: nudge(NUDGE_X),
});

// The area above one smooth sweep, its ends offset from `base` and nudged.
function areaAbove(w: number, base: number, e: Edge, nudgeL: number, nudgeR: number, nudgeX: number) {
  const left = base + e.left + nudgeL;
  const right = base + e.right + nudgeR;
  return `M0 0H${w}V${right}C${w * (e.bends[0] + nudgeX)} ${right + e.pull[0]} ${w * (e.bends[1] + nudgeX)} ${left + e.pull[1]} 0 ${left}Z`;
}

// How far below `base` the edge can reach (its ends or bends, nudged).
const lowest = (base: number, e: Edge) =>
  base + Math.max(e.left, e.right, e.left + e.pull[1], e.right + e.pull[0]) + NUDGE_Y + 4;

// A tab's green header (Browse, Price Watch), built like Home's backdrop:
// dark green on top, optionally a see-through pale sage below it, each
// ending in one smooth sweep, slightly reshaped at random on every visit to
// the tab.
// Scrolls with the page: render it first inside the ScrollView's content.
export const HeaderBackdrop = memo(function HeaderBackdrop({ bottom, curves: c }: HeaderBackdropProps) {
  const { width: w } = useWindowDimensions();
  const [n, setN] = useState(randomNudges);
  useFocusEffect(useCallback(() => setN(randomNudges()), []));

  const b = bottom ?? DEFAULT_BOTTOM;
  const s = b * c.splitAt;
  const dark = areaAbove(w, s, c.dark, n.darkL, n.darkR, n.darkBend);
  const pale = c.pale && areaAbove(w, b, c.pale, n.paleL, n.paleR, n.paleBend);
  const h = Math.max(lowest(s, c.dark), c.pale ? lowest(b, c.pale) : 0);

  return (
    <View pointerEvents="none" style={{ position: "absolute", left: 0, top: -OVERSCROLL, width: w, height: h + OVERSCROLL }}>
      <View className="bg-home-top" style={{ height: OVERSCROLL }} />
      <Svg width={w} height={h}>
        {pale && <Path d={pale} fill={colors.home.pale} fillOpacity={PALE_OPACITY} />}
        <Path d={dark} fill={colors.home.top} />
      </Svg>
    </View>
  );
});
