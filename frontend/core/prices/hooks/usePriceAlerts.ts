import { useEffect, useMemo } from "react";
import { useIsPro } from "@/frontend/core/pro/store/useProStore";
import { usePreferences } from "@/frontend/core/preferences/hooks/usePreferences";
import { usePriceAlertsSeenStore } from "../store/usePriceAlertsSeenStore";
import type { PriceItem } from "../utils/prices";
import { usePriceItems } from "./usePriceItems";

// How many drops the day's alert lists.
const ALERT_COUNT = 5;

// Pro's price alerts, one switch in Settings: each day DA publishes prices,
// the biggest drops in that day's report (week over week, the same change
// Price Watch shows), cheapest-going first. In-app: a card at the top of
// Price Watch and a dot on its tab until that day's alert has been seen.
// Nothing for free users or with alerts off.
export function usePriceAlerts() {
  const isPro = useIsPro();
  const enabled = usePreferences().prefs.price_alerts.enabled;
  const active = isPro && enabled;
  const items = usePriceItems();
  const seen = usePriceAlertsSeenStore((s) => s.seen);
  const loadSeen = usePriceAlertsSeenStore((s) => s.load);
  useEffect(() => {
    if (active) void loadSeen();
  }, [active, loadSeen]);

  // The latest report's date, and its drops.
  const { date, drops } = useMemo((): { date: string | null; drops: PriceItem[] } => {
    const all = items.data ?? [];
    if (!active || all.length === 0) return { date: null, drops: [] };
    const latest = all.reduce((max, i) => (i.latestDate > max ? i.latestDate : max), all[0].latestDate);
    const dropped = all
      .filter((i) => i.latestDate === latest && i.pctChange != null && i.pctChange < 0)
      .sort((a, b) => a.pctChange! - b.pctChange!)
      .slice(0, ALERT_COUNT);
    return { date: latest, drops: dropped };
  }, [active, items.data]);

  // One alert a day: seen once Price Watch has shown that day's drops.
  const key = date && drops.length > 0 ? `daily:${date}` : null;
  const unseen = !!key && !seen.has(key);
  const markSeen = () => {
    if (key) usePriceAlertsSeenStore.getState().markSeen([key]);
  };

  return { active, date, drops, unseen, markSeen };
}
