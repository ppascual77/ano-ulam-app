import { useEffect, useRef, useState } from "react";

const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3);

// A number that animates to `target` (ease-out-cubic) whenever it changes,
// starting from 0 on first show.
export function useCountUp(target: number, duration = 700) {
  const [value, setValue] = useState(0);
  const current = useRef(0);

  useEffect(() => {
    const from = current.current;
    const start = Date.now();
    let frame: number;
    const tick = () => {
      const t = Math.min(1, (Date.now() - start) / duration);
      current.current = from + (target - from) * easeOutCubic(t);
      setValue(current.current);
      if (t < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [target, duration]);

  return value;
}
