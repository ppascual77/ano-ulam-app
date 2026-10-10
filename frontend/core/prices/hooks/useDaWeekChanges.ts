import { useQuery } from "@tanstack/react-query";
import { getDailyPricesFor } from "@/api/priceWatch";
import { priceKeys } from "../queryKeys";
import { addDays, pctChange, toIsoDate, weekAgoPrice, type DailyPoint } from "../utils/prices";

export type DaWeekChange = { latestPrice: number; weekAgoPrice: number; pctChange: number };

// Two weeks back is enough to find a price on or before latest − 7 days,
// with room for days DA didn't publish.
const LOOKBACK_DAYS = 14;

// Week-over-week change of a few DA commodities (e.g. one ingredient's DA
// price cards), keyed by commodity id. Commodities without a price a week
// back are left out.
export function useDaWeekChanges(commodityIds: string[]) {
  return useQuery({
    queryKey: priceKeys.weekChanges(commodityIds),
    queryFn: async () => {
      const rows = await getDailyPricesFor(commodityIds, addDays(toIsoDate(new Date()), -LOOKBACK_DAYS));
      const daily = new Map<string, DailyPoint[]>();
      for (const r of rows) daily.set(r.da_commodity_id, [...(daily.get(r.da_commodity_id) ?? []), { date: r.price_date, price: r.price }]);
      const changes = new Map<string, DaWeekChange>();
      for (const [id, points] of daily) {
        const latest = points.at(-1)!.price;
        const weekAgo = weekAgoPrice(points);
        const pct = pctChange(latest, weekAgo);
        if (weekAgo != null && pct != null) changes.set(id, { latestPrice: latest, weekAgoPrice: weekAgo, pctChange: pct });
      }
      return changes;
    },
    enabled: commodityIds.length > 0,
    staleTime: 10 * 60 * 1000,
  });
}
