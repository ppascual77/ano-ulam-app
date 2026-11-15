// Fraction glyphs a recipe's free text may use, and the ones we write back.
const GLYPHS: Record<string, number> = {
  "⅛": 1 / 8,
  "¼": 1 / 4,
  "⅓": 1 / 3,
  "⅜": 3 / 8,
  "½": 1 / 2,
  "⅝": 5 / 8,
  "⅔": 2 / 3,
  "¾": 3 / 4,
  "⅞": 7 / 8,
};
const OUT_FRACTIONS: [number, string][] = [
  [1 / 8, "⅛"],
  [1 / 4, "¼"],
  [1 / 3, "⅓"],
  [3 / 8, "⅜"],
  [1 / 2, "½"],
  [5 / 8, "⅝"],
  [2 / 3, "⅔"],
  [3 / 4, "¾"],
  [7 / 8, "⅞"],
];
const GLYPH_CLASS = "[⅛¼⅓⅜½⅝⅔¾⅞]";

// The leading amount of a quantity: "1 1/2", "1/4", "1½", "1 ½", "0.5",
// ".5", "2", "½". Ordered so the longest reading wins ("1 1/2" before "1").
const LEADING_AMOUNT = new RegExp(
  `^(\\d+\\s+\\d+\\/\\d+|\\d+\\/\\d+|\\d+(?:\\.\\d+)?\\s*${GLYPH_CLASS}|\\d*\\.\\d+|\\d+|${GLYPH_CLASS})(.*)$`,
  "s",
);

function parseAmount(text: string): number {
  const mixed = text.match(/^(\d+)\s+(\d+)\/(\d+)$/);
  if (mixed) return Number(mixed[1]) + Number(mixed[2]) / Number(mixed[3]);
  const fraction = text.match(/^(\d+)\/(\d+)$/);
  if (fraction) return Number(fraction[1]) / Number(fraction[2]);
  const glyph = text.match(new RegExp(`^(\\d+(?:\\.\\d+)?)?\\s*(${GLYPH_CLASS})$`));
  if (glyph) return Number(glyph[1] ?? 0) + GLYPHS[glyph[2]];
  return parseFloat(text);
}

/** A quantity's leading amount and the text after it, or null when it has
 *  none ("to taste"). */
export function splitQty(qty: string): { amount: number; rest: string } | null {
  const match = qty.trim().match(LEADING_AMOUNT);
  if (!match) return null;
  const amount = parseAmount(match[1].trim());
  return Number.isFinite(amount) ? { amount, rest: match[2] } : null;
}

// How an amount reads: whole numbers as is; under 10, the nearest kitchen
// fraction when it's close ("½", "2¼", "⅛"); otherwise one decimal, as
// before ("0.3", "187.5").
export function formatAmount(amount: number): string {
  if (Number.isInteger(amount)) return String(amount);
  if (amount > 0 && amount < 10) {
    const whole = Math.floor(amount);
    const part = amount - whole;
    if (part < 0.02) return String(whole);
    if (part > 0.98) return String(whole + 1);
    const near = OUT_FRACTIONS.find(([value]) => Math.abs(part - value) < 0.02);
    if (near) return `${whole > 0 ? whole : ""}${near[1]}`;
  }
  return String(Math.round(amount * 10) / 10);
}

// Scales the leading amount in a quantity string ("250 grams" * 1.5 ->
// "375 grams", "1/4 cup" * 0.5 -> "⅛ cup"). Quantities with no leading
// number ("to taste") pass through.
export function multiplyQty(qty: string, scale: number): string {
  const split = splitQty(qty);
  if (!split) return qty;
  return `${formatAmount(split.amount * scale)}${split.rest}`;
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

// Rounded the same way multiplyQty rounds a scaled number. A fraction of
// one ("½ clove") stays singular.
export function formatCount(amount: number, label: string): string {
  const rounded = Number.isInteger(amount) ? amount : Math.round(amount * 10) / 10;
  return `${formatAmount(amount)} ${pluralize(label, rounded < 1 ? 1 : rounded)}`;
}
