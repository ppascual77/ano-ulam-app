import { Easing, type SharedValue, withSequence, withTiming } from "react-native-reanimated";

// Squash and stretch for a flying dot, shared by a page intro's landing dot
// (PageIntro) and the title-dot handoff between screens (DotHandoff), so
// both feel like the same bubbly dot.

// At full speed the dot is this much longer along its path (and thinner
// across it, keeping its area), round again as it slows.
const STRETCH = 0.9;
// Landing: a quick squash flat against the title, then a springy bounce
// back to round.
const SQUASH = 0.35;
const SQUASH_IN_MS = 70;
const SQUASH_OUT_MS = 160;

/** Transforms (after the translate and size scale) that stretch the dot
 *  along its path and squash it on landing. `f` is the eased flight
 *  progress (0-1) along a straight line from (ax, ay) to (bx, by) lifted by
 *  an arc of height `arc` (y - arc * 4f(1-f)); `land` runs 0 → 1 → 0. */
export function squashStretch(ax: number, ay: number, bx: number, by: number, arc: number, f: number, land: number) {
  "worklet";
  // Direction of travel: the path's slope here (rising, then falling).
  // Speed follows the ease, fastest midway, where it stretches most.
  const angle = Math.atan2(by - ay - arc * 4 * (1 - 2 * f), bx - ax);
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
