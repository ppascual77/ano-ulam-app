import { useQuery } from "@tanstack/react-query";
import { getDailyPricesSince, getPriceWatchCommodities } from "@/api/priceWatch";
import { priceKeys } from "../queryKeys";
import {
  addDays,
  categoryFor,
  pctChange,
  toIsoDate,
  weekAgoPrice,
  type DailyPoint,
  type PriceItem,
} from "../utils/prices";

// Enough for the 30-day chart plus a week-ago price at its start.
const HISTORY_DAYS = 37;

async function loadPriceItems(): Promise<PriceItem[]> {
  const since = addDays(toIsoDate(new Date()), -HISTORY_DAYS);
  const [commodities, prices] = await Promise.all([getPriceWatchCommodities(), getDailyPricesSince(since)]);

  const dailyById = new Map<string, DailyPoint[]>();
  for (const p of prices) {
    dailyById.set(p.da_commodity_id, [...(dailyById.get(p.da_commodity_id) ?? []), { date: p.price_date, price: p.price }]);
  }

  return commodities.map((c) => {
    // Older than HISTORY_DAYS (DA stopped reporting it): still listed, from
    // latest_price, just without a chart or change.
    const daily = dailyById.get(c.id) ?? [{ date: c.latest_price_date!, price: c.latest_price! }];
    const latest = daily.at(-1)!;
    const weekAgo = weekAgoPrice(daily);
    const ing = c.ingredient;
    const nutrition =
      ing && ing.calories != null && ing.protein != null && ing.carbohydrates != null && ing.fat != null
        ? {
            calories: ing.calories,
            protein: ing.protein,
            carbs: ing.carbohydrates,
            fats: ing.fat,
            basis: `${ing.basis_amount}${ing.basis_unit}`,
          }
        : null;
    return {
      id: c.id,
      name: c.commodity,
      specification: c.specification,
      unit: c.unit as PriceItem["unit"],
      unitSize: c.unit_size,
      category: categoryFor(c.section, c.commodity),
      ingredientId: c.ingredient_id,
      nutrition,
      daily,
      latestPrice: latest.price,
      latestDate: latest.date,
      weekAgoPrice: weekAgo,
      pctChange: pctChange(latest.price, weekAgo),
    };
  });
}

// Every DA commodity with a price, for Price Watch and Home's best value
// meals. ~200 rows, so filtering, search and sorting happen client-side.
export function usePriceItems() {
  return useQuery({ queryKey: priceKeys.items, queryFn: loadPriceItems, staleTime: 10 * 60 * 1000 });
}
