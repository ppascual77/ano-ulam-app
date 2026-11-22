// api/daPrices without the network or Supabase: the price utils only use
// formatDaUnit (same as api/daPrices.ts).
export function formatDaUnit(commodity) {
  if (commodity.unit === "piece") return "pc";
  if (commodity.unit === "bottle") {
    if (!commodity.unit_size) return "bottle";
    return commodity.unit_size < 1 ? `${Math.round(commodity.unit_size * 1000)}ml` : `${commodity.unit_size}L`;
  }
  return "kg";
}
