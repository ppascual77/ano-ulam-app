import type { IngredientCategory } from "@/frontend/core/meals/ingredientCategory";
import { formatDaUnit } from "@/api/daPrices";

// Price Watch's category ids, a subset of the ingredient category ids so the
// same icons are used (core/meals/ingredientCategory.ts).
export type PriceCategory = Extract<
  IngredientCategory,
  "meat" | "fish" | "vegetables" | "fruits" | "grains" | "eggs" | "spices" | "other"
>;

export type DailyPoint = { date: string; price: number };

export type PriceItem = {
  id: string;
  name: string;
  specification: string;
  unit: "kg" | "piece" | "bottle";
  unitSize: number | null;
  category: PriceCategory;
  ingredientId: string | null;
  // Per the linked ingredient's basis (e.g. per 100 g); null when unlinked
  // or any of the four is missing.
  nutrition: { calories: number; protein: number; carbs: number; fats: number; basis: string } | null;
  /** Oldest first. Gaps on days DA didn't publish; never filled in. */
  daily: DailyPoint[];
  latestPrice: number;
  latestDate: string;
  /** Price on or before latestDate − 7 days; null when there's none that old. */
  weekAgoPrice: number | null;
  /** % change vs weekAgoPrice, one decimal (−4.4 = 4.4% cheaper); null without a week-ago price. */
  pctChange: number | null;
};

// DA section header → category. Eggs sit under POULTRY PRODUCTS in the PDF.
export function categoryFor(section: string | null, commodity: string): PriceCategory {
  if (/\begg\b/i.test(commodity)) return "eggs";
  const s = (section ?? "").toUpperCase();
  if (/RICE|CORN/.test(s)) return "grains";
  if (/FISH/.test(s)) return "fish";
  if (/MEAT|POULTRY|LIVESTOCK/.test(s)) return "meat";
  if (/VEGETABLE|LEGUME/.test(s)) return "vegetables";
  if (/FRUIT/.test(s)) return "fruits";
  if (/SPICE/.test(s)) return "spices";
  return "other";
}

// "YYYY-MM-DD" as a local calendar date. new Date("2026-10-09") is UTC
// midnight, which can show as Oct 8 in Manila.
export function parseLocalDate(iso: string): Date {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d);
}

export function toIsoDate(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function addDays(iso: string, days: number): string {
  const d = parseLocalDate(iso);
  d.setDate(d.getDate() + days);
  return toIsoDate(d);
}

export const formatShortDate = (iso: string) =>
  parseLocalDate(iso).toLocaleDateString("en-PH", { month: "short", day: "numeric" });

export function weekAgoPrice(daily: DailyPoint[]): number | null {
  const latest = daily.at(-1);
  if (!latest) return null;
  const cutoff = addDays(latest.date, -7);
  for (let i = daily.length - 1; i >= 0; i--) {
    if (daily[i].date <= cutoff) return daily[i].price;
  }
  return null;
}

export function pctChange(latest: number, weekAgo: number | null): number | null {
  if (weekAgo == null || weekAgo === 0) return null;
  return Math.round(((latest - weekAgo) / weekAgo) * 1000) / 10;
}

export type Trend = "down" | "up" | "flat";
export const trendOf = (pct: number | null): Trend => (pct == null || pct === 0 ? "flat" : pct < 0 ? "down" : "up");

// "/kg", "/pc", "/1L"
export const unitSuffix = (item: Pick<PriceItem, "unit" | "unitSize">) =>
  `/${formatDaUnit({ unit: item.unit, unit_size: item.unitSize })}`;

export function unitLabel(item: Pick<PriceItem, "unit" | "unitSize">): string {
  if (item.unit === "piece") return "per piece";
  if (item.unit === "bottle") return `per ${formatDaUnit({ unit: item.unit, unit_size: item.unitSize })} bottle`;
  return "per kilogram";
}

export const formatPeso = (n: number) => `₱${Number.isInteger(n) ? n : n.toFixed(2)}`;

// The four "fresh picks" groups, in display order.
export const HERO_GROUPS: PriceCategory[][] = [["vegetables", "fruits"], ["fish"], ["meat", "eggs"], ["spices", "other"]];

// Ranked fresh picks, up to `limit`, spread across the groups for variety.
// Round 1 is one per group: its biggest drop, or when nothing dropped, its
// most stable item. Later rounds add each group's next-biggest drop (drops
// only). Each round is ordered biggest drop first.
export function pickFreshPicks(items: PriceItem[], limit: number): PriceItem[] {
  const byGroup = HERO_GROUPS.map((group) => {
    const inGroup = items.filter((i) => group.includes(i.category) && i.pctChange != null);
    const drops = inGroup.filter((i) => i.pctChange! < 0).sort((a, b) => a.pctChange! - b.pctChange!);
    if (drops.length > 0 || inGroup.length === 0) return drops;
    return [inGroup.reduce((a, b) => (Math.abs(b.pctChange!) < Math.abs(a.pctChange!) ? b : a))];
  });

  const picks: PriceItem[] = [];
  for (let round = 0; picks.length < limit; round++) {
    const next = byGroup.flatMap((list) => (list[round] ? [list[round]] : []));
    if (next.length === 0) break;
    picks.push(...next.sort((a, b) => a.pctChange! - b.pctChange!));
  }
  return picks.slice(0, limit);
}
