import { Text, View } from "react-native";
import Svg, { Path } from "react-native-svg";
import { colors } from "@/frontend/constants/theme";

// The paper luggage tag RandomMealPuller hangs from its cord: clipped top
// corners, a real punch hole the cord threads through (cut out, so whatever
// is behind shows through it), and a handwritten label. Drawn as an SVG
// since React Native views can't clip to a polygon.

// Overall size: every measurement below (paper, hole, label) is multiplied
// by this, so resizing the tag keeps it in proportion.
const SCALE = 0.8;
export const TAG_WIDTH = 132 * SCALE;
export const TAG_HEIGHT = 60 * SCALE;
// Punch hole: centered, near the top edge. The cord ends at HOLE_CENTER_Y so
// it reads as tied through the hole.
const HOLE_RADIUS = 4.5 * SCALE;
export const HOLE_CENTER_Y = 11 * SCALE;
// Corner chamfers, as fractions of the tag's size.
const CHAMFER_X = 0.18;
const CHAMFER_Y = 0.24;
const BOTTOM_RADIUS = 7 * SCALE;
const LABEL_SIZE = 24 * SCALE;
const LABEL_LINE_HEIGHT = 26 * SCALE;
// Nudges the label below the hole.
const LABEL_TOP_PAD = 12 * SCALE;

function tagPath() {
  const w = TAG_WIDTH;
  const h = TAG_HEIGHT;
  const cx = w * CHAMFER_X;
  const cy = h * CHAMFER_Y;
  const r = BOTTOM_RADIUS;
  const hx = w / 2;
  const hr = HOLE_RADIUS;
  const outline = `M${cx} 0H${w - cx}L${w} ${cy}V${h - r}Q${w} ${h} ${w - r} ${h}H${r}Q0 ${h} 0 ${h - r}V${cy}Z`;
  // Second subpath + evenodd fill = the hole is cut out of the paper.
  const hole = `M${hx - hr} ${HOLE_CENTER_Y}a${hr} ${hr} 0 1 0 ${hr * 2} 0a${hr} ${hr} 0 1 0 ${-hr * 2} 0Z`;
  return outline + hole;
}
const TAG_PATH = tagPath();

export function SurpriseTag() {
  return (
    // iOS draws the shadow from the SVG's alpha, so it follows the tag's shape.
    <View style={{ width: TAG_WIDTH, height: TAG_HEIGHT }} className="shadow-md">
      <Svg width={TAG_WIDTH} height={TAG_HEIGHT} style={{ position: "absolute" }}>
        <Path d={TAG_PATH} fill={colors.tag.bg} fillRule="evenodd" />
      </Svg>
      <View style={{ paddingTop: LABEL_TOP_PAD }} className="flex-1 items-center justify-center">
        <Text className="font-handwritten text-ink-emphasis" style={{ fontSize: LABEL_SIZE, lineHeight: LABEL_LINE_HEIGHT }} numberOfLines={1}>
          Surprise me!
        </Text>
      </View>
    </View>
  );
}
