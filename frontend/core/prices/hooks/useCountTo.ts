import { useEffect, useState } from "react";

// A number counting from `from` to `to` (ease-out) after `delayMs`, e.g. a
// price rolling from last week's to today's. Re-runs when any input changes.
export function useCountTo(from: number, to: number, delayMs: number, durationMs = 800) {
  const [value, setValue] = useState(from);
  useEffect(() => {
    let raf = 0;
    let start: number | null = null;
    setValue(from);
    const tick = (t: number) => {
      start ??= t;
      const u = Math.min(1, (t - start) / durationMs);
      setValue(from + (to - from) * (1 - Math.pow(1 - u, 3)));
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
