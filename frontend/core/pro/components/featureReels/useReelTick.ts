import { useEffect, useState } from "react";

/** A reel's beat: counts up every `periodMs` while `active` (the sheet is
 *  open and motion is allowed), back to 0 when it stops, so each opening
 *  plays from the start. */
export function useReelTick(active: boolean, periodMs: number) {
  const [tick, setTick] = useState(0);
  useEffect(() => {
    setTick(0);
    if (!active) return;
    const id = setInterval(() => setTick((t) => t + 1), periodMs);
    return () => clearInterval(id);
  }, [active, periodMs]);
  return tick;
}

/** The stage every reel plays on (px). */
export const REEL_HEIGHT = 236;
