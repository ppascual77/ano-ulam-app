import { supabase, invokeEdgeFunction } from "@/lib/supabase";
import type { Database } from "@/lib/database.types";
import { cheapestPricePatch, supermarketPriceOptions, type IngredientRow, type PriceOption } from "@/api/ingredients";

export type DaCommodityRow = Database["public"]["Tables"]["da_commodities"]["Row"];

// Mirrors supabase/functions/ingest-da-daily-prices/parse.ts.
export type DaUnit = "kg" | "piece" | "bottle";
export type DaParsedRow = {
  commodity: string;
  specification: string;
  section: string | null;
  unit: DaUnit;
  unitSize: number | null;
  price: number | null;
};
export type DaParsedPdf = { date: string; rows: DaParsedRow[] };
export type DaListedPdf = { date: string; url: string; revised: boolean };

export async function listDaDailyPdfs() {
  const data = await invokeEdgeFunction<{ pdfs: DaListedPdf[] }>("ingest-da-daily-prices", { action: "list" });
  return data.pdfs ?? [];
}

// Reads one PDF; writes nothing (saveDaDailyPrices does, after the admin
// confirms the preview).
export async function parseDaDailyPdf(url: string) {
  return invokeEdgeFunction<DaParsedPdf>("ingest-da-daily-prices", { action: "parse", url });
}

export const daCommodityKey = (c: { commodity: string; specification: string }) =>
  `${c.commodity}|${c.specification}`;

export async function getDaCommodities() {
  const { data, error } = await supabase.from("da_commodities").select("*").order("commodity");
  if (error) throw error;
  return data;
}

// Upserts every priced commodity (new ones are created unlinked; existing
// ones keep their ingredient link, since ingredient_id isn't in the payload)
// and that day's prices. Re-saving a day overwrites it. n/a rows are skipped.
// latest_price on each commodity is kept current by a DB trigger
// (20261010010000_da_commodities_latest_price.sql).
export async function saveDaDailyPrices(parsed: DaParsedPdf, sourceUrl: string) {
  const priced = parsed.rows.filter((r) => r.price != null);
  const { data: commodities, error } = await supabase
    .from("da_commodities")
    .upsert(
      priced.map((r) => ({
        commodity: r.commodity,
        specification: r.specification,
        section: r.section,
        unit: r.unit,
        unit_size: r.unitSize,
      })),
      { onConflict: "commodity,specification" },
    )
    .select();
  if (error) throw error;

  const idByKey = new Map(commodities.map((c) => [daCommodityKey(c), c.id]));
  const { error: priceError } = await supabase.from("daily_prices").upsert(
    priced.map((r) => ({
      da_commodity_id: idByKey.get(daCommodityKey(r))!,
      price_date: parsed.date,
      price: r.price!,
      source_url: sourceUrl,
    })),
    { onConflict: "da_commodity_id,price_date" },
  );
  if (priceError) throw priceError;
  return { saved: priced.length };
}

// A commodity prices at most one ingredient; an ingredient can have several
// commodities (e.g. Bangus ← "Bangus, Large" and "Bangus, Medium").
export async function linkDaCommodity(commodityId: string, ingredientId: string | null) {
  const { error } = await supabase.from("da_commodities").update({ ingredient_id: ingredientId }).eq("id", commodityId);
  if (error) throw error;
}

// DA's price as a price option in the units estimated_price allows (kg or L):
// - kg: as is
// - bottle (oil): ÷ liters per bottle → ₱/L
// - piece (eggs): ÷ grams per piece → ₱/kg, using the size DA states
//   ("56-60 grams/pc" → 58 g) or else the ingredient's own grams_per_piece
// null when there's no size to convert with.
export function daPriceOption(
  commodity: Pick<DaCommodityRow, "unit" | "unit_size">,
  price: number,
  ingredient: Pick<IngredientRow, "grams_per_piece">,
): PriceOption | null {
  if (commodity.unit === "kg") return { source: "da", pricePerUnit: price, unit: "kg" };
  if (commodity.unit === "bottle") {
    return commodity.unit_size ? { source: "da", pricePerUnit: price / commodity.unit_size, unit: "L" } : null;
  }
  const grams = commodity.unit_size ?? ingredient.grams_per_piece;
  return grams ? { source: "da", pricePerUnit: (price / grams) * 1000, unit: "kg" } : null;
}

export type DaPrice = { commodity: Pick<DaCommodityRow, "unit" | "unit_size">; price: number };

// Every linked commodity's latest price, for ingredientPricePatch.
export function linkedDaPrices(linked: DaCommodityRow[]): DaPrice[] {
  return linked.flatMap((commodity) =>
    commodity.latest_price != null ? [{ commodity, price: commodity.latest_price }] : [],
  );
}

// The ingredient's price fields given its DA prices (one per linked
// commodity, empty when none): the cheapest of those and its supermarket
// listings. null when nothing changes. price_sources itself is never
// touched here, DA is added next to it, not into it.
export function ingredientPricePatch(ingredient: IngredientRow, daPrices: DaPrice[]): Partial<IngredientRow> | null {
  const daOptions = daPrices.flatMap(({ commodity, price }) => daPriceOption(commodity, price, ingredient) ?? []);
  return cheapestPricePatch(ingredient, [...supermarketPriceOptions(ingredient.price_sources), ...daOptions]);
}

// Ingredient id → its linked commodities.
export function commoditiesByIngredient(commodities: DaCommodityRow[]): Map<string, DaCommodityRow[]> {
  const map = new Map<string, DaCommodityRow[]>();
  for (const c of commodities) {
    if (c.ingredient_id) map.set(c.ingredient_id, [...(map.get(c.ingredient_id) ?? []), c]);
  }
  return map;
}

export function formatDaUnit(commodity: { unit: string; unit_size: number | null }) {
  if (commodity.unit === "piece") return "pc";
  if (commodity.unit === "bottle") {
    if (!commodity.unit_size) return "bottle";
    return commodity.unit_size < 1 ? `${Math.round(commodity.unit_size * 1000)}ml` : `${commodity.unit_size}L`;
  }
  return "kg";
}
