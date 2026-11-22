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
  /** DA's section header ("PORK", "VEGETABLES"). Since Nov 2026 the animal
   *  is only here ("Chop, Local" under PORK), so search reads it too. */
  section: string | null;
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
  /** % change vs weekAgoPrice, one decimal (−4.4 = 4.4% cheaper); null without a week-ago price,
   *  and null when stale. */
  pctChange: number | null;
  /** DA stopped reporting it: its latest price is over STALE_AFTER_DAYS older than DA's newest
   *  report. Still listed (with "Last reported <date>"), never on the boards or in a price drop. */
  stale: boolean;
};

// How far behind DA's newest report an item's latest price can be before it
// counts as no longer reported. Measured from the newest report, not from
// today, so a few days without a DA report don't empty the boards.
export const STALE_AFTER_DAYS = 3;

// Marks items DA stopped reporting (White Potato Imported, last reported Nov 6,
// sat in the Dropped top 3 for weeks: BUG-11). Their weekly change is dropped,
// which keeps them off the Dropped / Went up boards, the fresh pick cards and
// Home's price drop, all of which go by pctChange.
export function markStale<T extends Pick<PriceItem, "latestDate" | "weekAgoPrice" | "pctChange">>(
  items: T[],
): (T & { stale: boolean })[] {
  const newest = items.reduce<string | null>((max, i) => (max == null || i.latestDate > max ? i.latestDate : max), null);
  if (newest == null) return [];
  const cutoff = addDays(newest, -STALE_AFTER_DAYS);
  return items.map((i) =>
    i.latestDate < cutoff ? { ...i, stale: true, weekAgoPrice: null, pctChange: null } : { ...i, stale: false },
  );
}

// DA section header → category. Eggs sat under POULTRY PRODUCTS in the PDF
// (their own EGG section since Nov 2026), so they go by name first.
export function categoryFor(section: string | null, commodity: string): PriceCategory {
  if (/\begg\b/i.test(commodity)) return "eggs";
  const s = (section ?? "").toUpperCase();
  if (/RICE|CORN/.test(s)) return "grains";
  if (/FISH/.test(s)) return "fish";
  // DA's sections until Oct 2026 ("PORK MEAT PRODUCTS", "POULTRY …"), and
  // since Nov 2026 the plain animal ("CHICKEN", "PORK", "BEEF", "BUFFALO",
  // "DUCK", and their "… OFFALS").
  if (/MEAT|POULTRY|LIVESTOCK|CHICKEN|PORK|BEEF|BUFFALO|CARABEEF|DUCK|OFFAL/.test(s)) return "meat";
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

// DA's meat sections since Nov 2026 name only the cut ("Chop, Local" under
// PORK), so the list couldn't tell pork from beef. The animal from the section
// goes in front, unless the name already says it ("Whole Duck").
const SECTION_ANIMAL: [RegExp, string][] = [
  [/^PORK\b/, "Pork"],
  [/^BEEF\b/, "Beef"],
  [/^CHICKEN\b/, "Chicken"],
  [/^BUFFALO\b/, "Carabeef"],
  [/^DUCK\b/, "Duck"],
];
export function priceItemName(commodity: string, section: string | null): string {
  const animal = SECTION_ANIMAL.find(([re]) => re.test((section ?? "").toUpperCase()))?.[1];
  if (!animal || new RegExp(`\\b${animal}\\b`, "i").test(commodity)) return commodity;
  return `${animal} ${commodity}`;
}

// Price Watch search: every word of the query somewhere in the name, DA's
// specification or its section, in any order. "pork chop" finds "Chop, Local"
// under PORK (DA dropped the animal from the name in Nov 2026).
export function matchesPriceSearch(item: Pick<PriceItem, "name" | "specification" | "section">, query: string): boolean {
  const words = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
  if (words.length === 0) return true;
  const text = `${item.name} ${item.specification} ${item.section ?? ""}`.toLowerCase();
  return words.every((w) => text.includes(w));
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

// The biggest price rises, up to `limit`, spread across the groups the same
// way (one per group first, then each group's next), biggest rise first:
// Price Watch's "went up" board, so a heads-up isn't all one kind of food.
export function pickPriceRises(items: PriceItem[], limit: number): PriceItem[] {
  const byGroup = HERO_GROUPS.map((group) =>
    items
      .filter((i) => group.includes(i.category) && i.pctChange != null && i.pctChange > 0)
      .sort((a, b) => b.pctChange! - a.pctChange!),
  );
  const rises: PriceItem[] = [];
  for (let round = 0; rises.length < limit; round++) {
    const next = byGroup.flatMap((list) => (list[round] ? [list[round]] : []));
    if (next.length === 0) break;
    rises.push(...next.sort((a, b) => b.pctChange! - a.pctChange!));
  }
  return rises.slice(0, limit);
}

// Whole pesos for meal prices (not commodity prices: formatPeso keeps
// centavos there) ("₱130", "₱1,240"), and a range when there's a
// buffer ("₱130–150"). Centavos read like a receipt; meals are estimates.
export function formatMealPrice(price: number | string | null | undefined, buffer?: number | string | null): string {
  const whole = (v: number | string) => Math.round(Number(v)).toLocaleString("en-PH");
  if (price == null || price === "") return "";
  return `₱${whole(price)}${buffer ? `–${whole(buffer)}` : ""}`;
}
