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

// Count nouns for generated quantities ("1 clove", "3 cloves"). Only ever
// applied to labels this app generates (see formatCount), never to a
// recipe's free-text display_text, where blind pluralizing would turn
// "2 cups rice" into "2 cups rices".
function pluralize(label: string, n: number): string {
  if (n === 1) return label;
  if (/(s|x|z|ch|sh)$/.test(label)) return `${label}es`;
  if (/[^aeiou]y$/.test(label)) return `${label.slice(0, -1)}ies`;
  return `${label}s`;
}

// Rounded the same way multiplyQty rounds a scaled number.
export function formatCount(amount: number, label: string): string {
  const rounded = Number.isInteger(amount) ? amount : Math.round(amount * 10) / 10;
  return `${rounded} ${pluralize(label, rounded)}`;
}
