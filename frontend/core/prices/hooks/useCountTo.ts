import { useEffect, useState } from "react";

// A number counting from `from` to `to` after `delayMs`, e.g. a price
// rolling from last week's to today's. Ease-in-out, so it eases off the
// start instead of jumping (ease-out lurched most of the way in the first
// frames), then settles. Re-runs when any input changes. Show it with
// tabular digits (fontVariant: ["tabular-nums"]) so it doesn't wobble.
export function useCountTo(from: number, to: number, delayMs: number, durationMs = 800) {
  const [value, setValue] = useState(from);
  useEffect(() => {
    let raf = 0;
    let start: number | null = null;
    setValue(from);
    const tick = (t: number) => {
      start ??= t;
      const u = Math.min(1, (t - start) / durationMs);
      const eased = u < 0.5 ? 4 * u * u * u : 1 - Math.pow(-2 * u + 2, 3) / 2;
      setValue(from + (to - from) * eased);
      if (u < 1) raf = requestAnimationFrame(tick);
    };
    const timer = setTimeout(() => {
      raf = requestAnimationFrame(tick);
    }, delayMs);
    return () => {
      clearTimeout(timer);
      cancelAnimationFrame(raf);
    };
  }, [from, to, delayMs, durationMs]);
  return value;
}
