import { useMemo } from "react";
import { usePriceItems } from "./usePriceItems";
import type { PriceItem } from "../utils/prices";

// Only a real drop is worth calling out (rounding noise isn't).
const MIN_DROP_PCT = 3;

// The DA commodity whose price fell most since last week (Price Watch's own
// numbers), or null when nothing dropped enough. Home's live line and the
// Settings Pro card use it.
export function useBiggestPriceDrop(): PriceItem | null {
  const { data } = usePriceItems();
  return useMemo(() => {
    const drops = (data ?? []).filter((i) => i.pctChange != null && i.pctChange <= -MIN_DROP_PCT);
    drops.sort((a, b) => (a.pctChange ?? 0) - (b.pctChange ?? 0));
    return drops[0] ?? null;
  }, [data]);
}

// "Tomato, Local" -> "Tomato".
export const commodityShortName = (item: PriceItem) => item.name.split(",")[0].trim();
