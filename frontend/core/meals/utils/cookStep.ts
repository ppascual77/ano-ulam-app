import { groupIngredients } from "./ingredientOrder";
import { formatAmount, formatCount, splitQty } from "./multiplyQty";
import type { IngredientType } from "../mealTypes";

// Helpers for cook mode: the ingredient list it shows, and which words of a
// step's text name one of those ingredients.
//
// The matching is deliberately modest: it only points at words the step
// actually contains, never claims a step's full ingredient list. A word it
// misses just reads as plain text, and the full list is one tap away.

/** One line of cook mode's ingredient list (already scaled). */
export type CookIngredient = { key: string; name: string; qty: string };
export type CookIngredientGroup = { section: string | null; items: CookIngredient[] };

/** A run of step text; `keys` when it names an ingredient, `amount` when
 *  its quantity should show beside it. */
export type StepSegment = { text: string; keys?: string[]; amount?: string };

/** "Binagoongan Pork (Binagoongang Baboy)" -> "Binagoongan Pork". */
export function shortMealName(name: string) {
  return name.replace(/\s*\([^)]*\)\s*$/, "").trim() || name;
}

/** A step's first sentence (read as its headline) and the rest. Only split
 *  where the next sentence starts with a capital, so "1 tbsp. of" stays. */
export function splitStep(step: string): { lead: string; detail: string | null } {
  const match = step.trim().match(/^(.{12,}?[.!?])\s+([A-Z][\s\S]*)$/);
  return match ? { lead: match[1], detail: match[2] } : { lead: step.trim(), detail: null };
}

// Two lines of the same ingredient in one section ("Water ½ cup" and
// "Water ⅛ cup", used at different steps) read as one, when their units
// match. Different units stay as separate lines.
function mergeSame(items: IngredientType[]): IngredientType[] {
  const out: IngredientType[] = [];
  for (const item of items) {
    const name = item.name.trim().toLowerCase();
    const prev = out.find((o) => o.name.trim().toLowerCase() === name);
    if (prev) {
      if (prev.count && item.count && prev.count.label === item.count.label) {
        const amount = prev.count.amount + item.count.amount;
        out[out.indexOf(prev)] = { ...prev, count: { ...prev.count, amount }, qty: formatCount(amount, prev.count.label) };
        continue;
      }
      const a = !prev.count ? splitQty(prev.qty) : null;
      const b = !item.count ? splitQty(item.qty) : null;
      if (a && b && a.rest.trim().toLowerCase() === b.rest.trim().toLowerCase()) {
        out[out.indexOf(prev)] = { ...prev, qty: `${formatAmount(a.amount + b.amount)}${a.rest}` };
        continue;
      }
    }
    out.push(item);
  }
  return out;
}

/** The meal's ingredients as cook mode lists them: the meal page's order and
 *  sections, repeated lines merged. Pass them already scaled. */
export function cookIngredientGroups(ingredients: IngredientType[]): {
  groups: CookIngredientGroup[];
  terms: Map<string, string[]>;
} {
  const terms = new Map<string, string[]>();
  const addTerm = (term: string, key: string) => {
    const t = term.replace(/\s+/g, " ").trim();
    if (t.length < 3) return;
    const keys = terms.get(t) ?? [];
    if (!keys.includes(key)) terms.set(t, [...keys, key]);
  };

  const groups = groupIngredients(ingredients).map((group, gi) => ({
    section: group.section,
    items: mergeSame(group.items).map((item, ii) => ({ key: `${gi}:${ii}`, name: item.name, qty: item.qty, displayName: item.displayName })),
  }));

  // Names a step might use: the name and display name without notes after
  // a comma ("Bell pepper, green, raw"), and each alternative in brackets
  // ("Pork belly (liempo)" -> "pork belly", "liempo").
  // Plus one word on its own: the last of the name ("Red onion" -> "onion")
  // and the first of a bracketed alternative ("bagoong alamang" ->
  // "bagoong"), only when that word belongs to one ingredient name (two
  // "Cooking oil" lines share "oil") and isn't too generic to mean one.
  const words = new Map<string, { names: Set<string>; keys: string[] }>();
  const addWord = (word: string, base: string, key: string) => {
    if (word.length < 3 || GENERIC_WORDS.has(word)) return;
    const entry = words.get(word) ?? { names: new Set<string>(), keys: [] };
    entry.names.add(base);
    if (!entry.keys.includes(key)) entry.keys.push(key);
    words.set(word, entry);
  };
  for (const item of groups.flatMap((g) => g.items)) {
    for (const raw of [item.name, item.displayName]) {
      if (!raw) continue;
      const lower = raw.toLowerCase();
      const base = lower.replace(/\([^)]*\)/g, " ").split(",")[0].replace(/\s+/g, " ").trim();
      addTerm(base, item.key);
      const baseWords = base.split(" ");
      if (baseWords.length > 1) addWord(baseWords[baseWords.length - 1], base, item.key);
      for (const m of lower.matchAll(/\(([^)]+)\)/g)) {
        for (const alt of m[1].split(/,|\/|\bor\b/)) {
          const t = alt.replace(/\s+/g, " ").trim();
          addTerm(t, item.key);
          const altWords = t.split(" ");
          if (altWords.length > 1 && altWords[0].length >= 5) addWord(altWords[0], base, item.key);
        }
      }
    }
  }
  for (const [word, { names, keys }] of words) if (names.size === 1 && !terms.has(word)) keys.forEach((k) => addTerm(word, k));

  return {
    groups: groups.map((g) => ({ section: g.section, items: g.items.map(({ key, name, qty }) => ({ key, name, qty })) })),
    terms,
  };
}

const GENERIC_WORDS = new Set(["sauce", "powder", "paste", "pepper", "leaves", "seeds", "stock", "broth", "juice", "water", "flakes", "mix", "fresh", "green", "white"]);
const WORD_CHAR = /[a-z0-9À-ɏ]/i;
const NUMBER_WORDS = /^(half|one|two|three|four|five|six|seven|eight|nine|ten|dozen|couple|few|some|remaining|rest)$/i;

// Whether the step already gives an amount right before the word ("1 cup
// of water", "half the garlic"): the scaled amount beside it would clash
// with the recipe's own number (steps aren't rescaled with servings).
function amountBefore(text: string, start: number) {
  const clause = text.slice(0, start).split(/[.;:!?,()]/).pop() ?? "";
  return clause
    .trim()
    .split(/\s+/)
    .slice(-4)
    .some((w) => /\d|[⅛¼⅓⅜½⅝⅔¾⅞]/.test(w) || NUMBER_WORDS.test(w));
}

/** Splits each text (a step's lead, then its detail) into plain runs and
 *  the words naming an ingredient. An ingredient's amount shows beside its
 *  first mention only, and only when the word means one ingredient, it has
 *  a number, and the text doesn't give its own amount there. */
export function findMentions(
  texts: string[],
  terms: Map<string, string[]>,
  qtyByKey: Map<string, string>,
): { parts: StepSegment[][]; mentioned: Set<string> } {
  const mentioned = new Set<string>();
  const seen = new Set<string>();
  const parts = texts.map((text) => {
    const lower = text.toLowerCase();
    const found: { start: number; end: number; keys: string[] }[] = [];
    for (const [term, keys] of terms) {
      let from = 0;
      for (;;) {
        const at = lower.indexOf(term, from);
        if (at < 0) break;
        from = at + 1;
        let end = at + term.length;
        // A plural ("cubes", "tomatoes").
        if (lower.startsWith("es", end) && !WORD_CHAR.test(lower[end + 2] ?? "")) end += 2;
        else if (lower[end] === "s" && !WORD_CHAR.test(lower[end + 1] ?? "")) end += 1;
        if (WORD_CHAR.test(lower[at - 1] ?? "") || WORD_CHAR.test(lower[end] ?? "")) continue;
        found.push({ start: at, end, keys });
      }
    }
    // Longest first, so "pork belly" wins over "belly"; no overlaps.
    found.sort((a, b) => b.end - b.start - (a.end - a.start) || a.start - b.start);
    const picked: typeof found = [];
    for (const f of found) if (!picked.some((p) => f.start < p.end && p.start < f.end)) picked.push(f);
    picked.sort((a, b) => a.start - b.start);

    const segments: StepSegment[] = [];
    let cursor = 0;
    for (const p of picked) {
      if (p.start > cursor) segments.push({ text: text.slice(cursor, p.start) });
      p.keys.forEach((k) => mentioned.add(k));
      const key = p.keys.length === 1 ? p.keys[0] : null;
      const qty = key ? qtyByKey.get(key) : undefined;
      const first = key != null && !seen.has(key);
      if (key) seen.add(key);
      const amount = first && qty && splitQty(qty) && !amountBefore(text, p.start) ? qty : undefined;
      segments.push({ text: text.slice(p.start, p.end), keys: p.keys, amount });
      cursor = p.end;
    }
    if (cursor < text.length) segments.push({ text: text.slice(cursor) });
    return segments;
  });
  return { parts, mentioned };
}
