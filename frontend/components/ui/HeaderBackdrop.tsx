import { memo, useCallback, useState } from "react";
import { View, useWindowDimensions } from "react-native";
import { useFocusEffect } from "expo-router";
import Svg, { ClipPath, Defs, G, Path, RadialGradient, Rect, Stop } from "react-native-svg";
import { colors } from "@/frontend/constants/theme";
import { DOODLES, drawDoodle } from "./doodles";

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

// The tab headers' shared curve (Browse, Price Watch): dark green only,
// higher on the right, dipping towards the left. One shape so the tabs read
// as one family (each visit still nudges it a little, below).
export const TAB_HEADER_CURVES: HeaderCurves = {
  splitAt: 0.74,
  dark: { left: 40, right: -18, bends: [0.8, 0.4], pull: [-6, 18] },
};

// The texture over the dark green: a soft light from the top right, and the
// brand's hand-drawn doodles (the onboarding set) scattered faintly. Spots
// are shares of the width / of the header's height.
const LIGHT_OPACITY = 0.16;
const DOODLE_OPACITY = 0.08;
const DOODLE_SPOTS: { doodle: keyof typeof DOODLES; x: number; y: number; size: number; rotate: number }[] = [
  { doodle: "spiral", x: 0.78, y: 0.16, size: 30, rotate: 0 },
  { doodle: "star", x: 0.92, y: 0.42, size: 22, rotate: 14 },
  { doodle: "zigzags", x: 0.6, y: 0.08, size: 26, rotate: -10 },
  { doodle: "circle", x: 0.66, y: 0.5, size: 16, rotate: 0 },
  { doodle: "triangle", x: 0.86, y: 0.7, size: 14, rotate: 24 },
  { doodle: "dots", x: 0.46, y: 0.3, size: 18, rotate: 0 },
  { doodle: "zigzags", x: 0.08, y: 0.86, size: 22, rotate: 8 },
];

type HeaderBackdropProps = {
  /** Where the header's content ends (in the scroll content), e.g. Browse's
   *  search row: the green covers everything above it. */
  bottom: number | null;
  curves: HeaderCurves;
  /** The soft light and faint doodles over the green. */
  texture?: boolean;
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
export const HEADER_OVERSCROLL = 1000;
const OVERSCROLL = HEADER_OVERSCROLL;

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
export const HeaderBackdrop = memo(function HeaderBackdrop({ bottom, curves: c, texture = false }: HeaderBackdropProps) {
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
      {/* One drawing from the overscroll down, so the light runs on above
          the content's top edge (behind the status bar) instead of stopping
          there in a hard line. */}
      <Svg width={w} height={h + OVERSCROLL}>
       <G transform={`translate(0 ${OVERSCROLL})`}>
        <Rect x={0} y={-OVERSCROLL} width={w} height={OVERSCROLL + 1} fill={colors.home.top} />
        {pale && <Path d={pale} fill={colors.home.pale} fillOpacity={PALE_OPACITY} />}
        <Path d={dark} fill={colors.home.top} />
        {texture && <HeaderTexture id="tabHeader" width={w} height={h} dark={dark} depth={s} />}
       </G>
      </Svg>
    </View>
  );
});

type HeaderTextureProps = {
  /** Unique per screen (the gradient and clip ids). */
  id: string;
  width: number;
  /** The drawing's height below the content's top. */
  height: number;
  /** The dark green's path: the texture stays inside it (and the overscroll
   *  above it). */
  dark: string;
  /** About how deep the dark green reaches: the doodles spread over it. */
  depth: number;
};

// The texture over a dark green header (Browse, Price Watch, Home): a soft
// light from the top right and the brand's doodles, faint. Render inside the
// header's Svg, in the group shifted down by OVERSCROLL, after the green.
// The light runs up into the overscroll too, so nothing ends in a hard line
// behind the status bar.
export function HeaderTexture({ id, width: w, height: h, dark, depth }: HeaderTextureProps) {
  // Drawn once per mount: the doodles keep their hand-drawn wobble but don't
  // change shape on every render.
  const [doodles] = useState(() => DOODLE_SPOTS.map((spot) => ({ ...spot, version: drawDoodle(DOODLES[spot.doodle]) })));
  return (
    <>
      <Defs>
        <ClipPath id={`${id}Dark`}>
          <Rect x={0} y={-OVERSCROLL} width={w} height={OVERSCROLL + 1} />
          <Path d={dark} />
        </ClipPath>
        <RadialGradient id={`${id}Light`} cx={w * 0.85} cy={0} r={w * 0.9} gradientUnits="userSpaceOnUse">
          <Stop offset="0" stopColor={colors.white} stopOpacity={LIGHT_OPACITY} />
          <Stop offset="1" stopColor={colors.white} stopOpacity={0} />
        </RadialGradient>
      </Defs>
      <G clipPath={`url(#${id}Dark)`}>
        <Rect x={0} y={-OVERSCROLL} width={w} height={h + OVERSCROLL} fill={`url(#${id}Light)`} />
        {doodles.map(({ version, x, y, size, rotate }, i) => (
          <G key={i} transform={`translate(${w * x} ${depth * y}) rotate(${rotate}) scale(${size / 24}) translate(-12 -12)`}>
            {version.d ? (
              <Path
                d={version.d}
                stroke={colors.white}
                strokeOpacity={DOODLE_OPACITY}
                strokeWidth={2.4}
                strokeLinecap="round"
                strokeLinejoin="round"
                fill={version.filled ? colors.white : "none"}
                fillOpacity={version.filled ? DOODLE_OPACITY : 0}
              />
            ) : null}
            {version.dots.map(([cx, cy, r], k) => (
              <Rect key={k} x={cx - r} y={cy - r} width={r * 2} height={r * 2} rx={r} fill={colors.white} fillOpacity={DOODLE_OPACITY} />
            ))}
          </G>
        ))}
      </G>
    </>
  );
}
