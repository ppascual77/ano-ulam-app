import { useEffect, useState } from "react";
import { useReduceMotion } from "@/frontend/core/preferences/store/useReduceMotionStore";

// ~30 updates a second: half the re-renders of every frame, and still
// smooth for a number ticking over.
const FRAME_MS = 33;

// A number counting from `from` to `to` (ease-out) after `delayMs`, e.g. a
// price rolling from last week's to today's. Re-runs when any input changes.
// With Reduce motion on it's just `to`.
export function useCountTo(from: number, to: number, delayMs: number, durationMs = 800) {
  const reduceMotion = useReduceMotion();
  const [value, setValue] = useState(reduceMotion ? to : from);
  useEffect(() => {
    if (reduceMotion) {
      setValue(to);
      return;
    }
    let raf = 0;
    let start: number | null = null;
    let lastShown = -Infinity;
    setValue(from);
    const tick = (t: number) => {
      start ??= t;
      const u = Math.min(1, (t - start) / durationMs);
      // Throttled, but the final value always lands.
      if (u === 1 || t - lastShown >= FRAME_MS) {
        lastShown = t;
        setValue(from + (to - from) * (1 - Math.pow(1 - u, 3)));
      }
      if (u < 1) raf = requestAnimationFrame(tick);
    };
    const timer = setTimeout(() => {
      raf = requestAnimationFrame(tick);
    }, delayMs);
    return () => {
      clearTimeout(timer);
      cancelAnimationFrame(raf);
    };
  }, [from, to, delayMs, durationMs, reduceMotion]);
  return value;
}
