import { useEffect, useMemo } from "react";
import { useIsPro } from "@/frontend/core/pro/store/useProStore";
import { usePreferences } from "@/frontend/core/preferences/hooks/usePreferences";
import { usePriceAlertsSeenStore } from "../store/usePriceAlertsSeenStore";
import type { PriceItem } from "../utils/prices";
import { usePriceItems } from "./usePriceItems";

export type PriceAlert = {
  ingredientId: string;
  /** The watched ingredient's name, as picked in Settings. */
  name: string;
  /** This week's change across its DA commodities (mean), e.g. −12.5. */
  pct: number;
  /** Its DA commodity that dropped most: what the alert shows and opens. */
  item: PriceItem;
  /** Seen-state key: the same drop stays seen, a new day's is new. */
  key: string;
};

const THRESHOLD_PCT = { any: 0, "10pct": -10 } as const;

// Pro's in-app price drop alerts: each watched ingredient (Settings > Price
// alerts) whose DA price is down this week (week over week, the same
// change Price Watch shows), past the chosen threshold. Ingredients with no
// linked DA commodity can't alert (`untracked`). Nothing for free users or
// with alerts paused. `unseen`: any alert not yet seen in Price Watch.
export function usePriceAlerts() {
  const isPro = useIsPro();
  const { price_alerts: settings } = usePreferences().prefs;
  const active = isPro && settings.enabled && settings.ingredients.length > 0;
  const items = usePriceItems();
  const seen = usePriceAlertsSeenStore((s) => s.seen);
  const loadSeen = usePriceAlertsSeenStore((s) => s.load);
  useEffect(() => {
    if (active) void loadSeen();
  }, [active, loadSeen]);

  const { alerts, untracked } = useMemo(() => {
    if (!active) return { alerts: [] as PriceAlert[], untracked: [] as string[] };
    const byIngredient = new Map<string, PriceItem[]>();
    for (const item of items.data ?? []) {
      if (item.ingredientId) byIngredient.set(item.ingredientId, [...(byIngredient.get(item.ingredientId) ?? []), item]);
    }
    const found: PriceAlert[] = [];
    const missing: string[] = [];
    for (const watched of settings.ingredients) {
      const commodities = byIngredient.get(watched.id);
      if (!commodities) {
        missing.push(watched.name);
        continue;
      }
      const changed = commodities.filter((c) => c.pctChange != null);
      if (changed.length === 0) continue;
      const pct = changed.reduce((sum, c) => sum + c.pctChange!, 0) / changed.length;
      if (pct >= 0 || pct > THRESHOLD_PCT[settings.threshold]) continue;
      const item = changed.reduce((best, c) => (c.pctChange! < best.pctChange! ? c : best));
      found.push({
        ingredientId: watched.id,
        name: watched.name,
        pct: Math.round(pct * 10) / 10,
        item,
        key: `${watched.id}:${item.latestDate}`,
      });
    }
    found.sort((a, b) => a.pct - b.pct);
    return { alerts: found, untracked: missing };
  }, [active, items.data, settings.ingredients, settings.threshold]);

  const unseen = alerts.some((a) => !seen.has(a.key));
  const markSeen = () => usePriceAlertsSeenStore.getState().markSeen(alerts.map((a) => a.key));

  return { active, alerts, untracked, unseen, loading: active && items.isLoading, markSeen };
}
