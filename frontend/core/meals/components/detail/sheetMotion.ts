import { useEffect, useState } from "react";
import { Easing, FadeInDown, useReducedMotion } from "react-native-reanimated";

// The ingredient sheet's open choreography. The sheet's own rise is
// BottomSheet's; its content follows just behind in reading order (header,
// then each section 60ms apart), then the numbers draw themselves (the
// cost and kcal count up, the bars grow in, see GrowFill).

const RISE_EASING = Easing.bezier(0.2, 0.8, 0.2, 1);
const RISE_START_MS = 120;
const RISE_STAGGER_MS = 60;

/** When the macro split and kcal start, and when the micronutrient bars do. */
export const MACRO_GROW_DELAY = 380;
export const MICRO_GROW_DELAY = 480;

/** Entering animation for the sheet's `index`th block: fades up 8px.
 *  Reanimated skips it when the OS asks for reduced motion. */
export function riseIn(index: number) {
  return FadeInDown.duration(320)
    .delay(RISE_START_MS + index * RISE_STAGGER_MS)
    .easing(RISE_EASING)
    .withInitialValues({ opacity: 0, transform: [{ translateY: 8 }] });
}

/** Counts from 0 up to `to` (rounded) after `delay`, easing out. Shows `to`
 *  straight away with reduced motion on. Restarts when the component
 *  remounts, so key the sheet's content to replay it. */
export function useCountUp(to: number, delay: number, duration: number) {
  const reduceMotion = useReducedMotion();
  const target = Math.round(to);
  const [value, setValue] = useState(reduceMotion ? target : 0);

  useEffect(() => {
    if (reduceMotion) {
      setValue(target);
      return;
    }
    let frame = 0;
    let start: number | undefined;
    const step = (now: number) => {
      start ??= now;
      const p = Math.min(1, (now - start) / duration);
      setValue(Math.round(target * (1 - Math.pow(1 - p, 4))));
      if (p < 1) frame = requestAnimationFrame(step);
    };
    const timer = setTimeout(() => {
      frame = requestAnimationFrame(step);
    }, delay);
    return () => {
      clearTimeout(timer);
      cancelAnimationFrame(frame);
    };
  }, [target, delay, duration, reduceMotion]);

  return value;
}
