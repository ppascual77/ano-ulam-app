// Scales the leading number in a quantity string (e.g. "250 grams" * 1.5 ->
// "375 grams"). Quantities with no leading number ("to taste") pass through.
export function multiplyQty(qty: string, scale: number): string {
  const match = qty.match(/^([\d.]+)(.*)$/);
  if (!match) return qty;
  const [, numStr, rest] = match;
  const scaled = parseFloat(numStr) * scale;
  const rounded = Number.isInteger(scaled) ? scaled : Math.round(scaled * 10) / 10;
  return `${rounded}${rest}`;
}
