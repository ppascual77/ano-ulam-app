import { Easing, type SharedValue, withSequence, withTiming } from "react-native-reanimated";

// The flying dot's whole motion, shared by a page intro's landing dot
// (PageIntro) and the title-dot handoff between screens (DotHandoff), so
// both are the same bubbly dot: same flight time, ease, arc, swell, squash
// and stretch.

/** One flight, start to landing (before the landing squash). */
export const DOT_FLY_MS = 650;
export const DOT_FLY_EASING = Easing.inOut(Easing.cubic);
// How high the dot arcs on its way.
const ARC = 70;
// How much it swells mid-flight.
const SWELL = 1.2;

// At full speed the dot is this much longer along its path (and thinner
// across it, keeping its area), round again as it slows.
const STRETCH = 0.9;
// Landing: a quick squash flat against the title, then a springy bounce
// back to round.
const SQUASH = 0.35;
const SQUASH_IN_MS = 70;
const SQUASH_OUT_MS = 160;

// Stretches the dot along its path and squashes it on landing. `f` is the
// eased flight progress (0-1); `land` runs 0 → 1 → 0.
function squashStretch(ax: number, ay: number, bx: number, by: number, f: number, land: number) {
  "worklet";
  // Direction of travel: the path's slope here (rising, then falling).
  // Speed follows the ease, fastest midway, where it stretches most.
  const angle = Math.atan2(by - ay - ARC * 4 * (1 - 2 * f), bx - ax);
  const stretch = 1 + STRETCH * Math.sin(Math.PI * f);
  // Wide and flat: it lands moving down onto the title.
  const squash = land * SQUASH;
  return [
    { scaleX: 1 + squash },
    { scaleY: 1 - squash },
    { rotate: `${angle}rad` },
    { scaleX: stretch },
    { scaleY: 1 / stretch },
  ];
}

/** Runs the landing squash on `land`, then `onSettled` (on the UI thread;
 *  hop to JS with scheduleOnRN). */
export function landSquash(land: SharedValue<number>, onSettled: () => void) {
  "worklet";
  land.value = withSequence(
    withTiming(1, { duration: SQUASH_IN_MS, easing: Easing.out(Easing.quad) }),
    withTiming(0, { duration: SQUASH_OUT_MS, easing: Easing.out(Easing.back(2.5)) }, (settled) => {
      if (settled) onSettled();
    }),
  );
}

/** A flying dot's transform at progress `f` (0-1, already eased) from
 *  `from` to `to` (centers), for a dot drawn `drawn` px wide at its
 *  top-left. `sizeAt` is the dot's size in px at this point. */
export function dotFlightTransform(
  from: { x: number; y: number },
  to: { x: number; y: number },
  f: number,
  land: number,
  drawn: number,
  sizeAt: number,
) {
  "worklet";
  const x = from.x + (to.x - from.x) * f;
  const y = from.y + (to.y - from.y) * f - ARC * 4 * f * (1 - f);
  const scale = (sizeAt / drawn) * (1 + (SWELL - 1) * Math.sin(Math.PI * f));
  return [
    { translateX: x - drawn / 2 },
    { translateY: y - drawn / 2 },
    { scale },
    ...squashStretch(from.x, from.y, to.x, to.y, f, land),
  ];
}
