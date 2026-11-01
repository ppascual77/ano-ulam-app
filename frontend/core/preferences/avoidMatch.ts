import type { AvoidedIngredient } from "@/api/auth";

// How an ingredient to avoid matches catalog ingredients, shared by the
// filter (useAvoidFilter), the counts (useAvoidImpact) and the picker, so
// they always agree. An entry is either:
// - one food by its base name, the part before the first comma, so "Chicken
//   wing" covers "Chicken wing, raw" and "Chicken wing, cooked"; or
// - a whole food (`family`, a word): every ingredient with that word in its
//   name ("chicken": Chicken thigh, Whole chicken, Ground chicken...), plus
//   the whole category when the word names one ("pork": Lechon, Sisig,
//   Chicharon). "Chicken egg" is an egg, not chicken: egg items only match
//   the word "egg".

type CatalogIngredient = { id: string; canonical_name: string; category?: string | null };

// Plural and singular alike: "peanuts" ~ "peanut", "beans" ~ "bean".
const norm = (word: string) => (word.length > 3 && word.endsWith("s") && !word.endsWith("ss") ? word.slice(0, -1) : word);
const wordsOf = (name: string) => name.toLowerCase().split(/[^a-z]+/).filter(Boolean).map(norm);

/** "Chicken wing, raw" -> "chicken wing". */
export const baseOf = (canonicalName: string) => wordsOf(canonicalName.split(",")[0]).join(" ");

/** Whether the whole food `family` (a word) covers this ingredient. */
export function familyMatches(family: string, ingredient: CatalogIngredient) {
  const f = norm(family.toLowerCase());
  if (ingredient.category && norm(ingredient.category.toLowerCase()) === f) return true;
  const words = wordsOf(ingredient.canonical_name);
  if (!words.includes(f)) return false;
  return f === "egg" || !words.includes("egg");
}

/** Whether this catalog ingredient is covered by the entry. */
export function entryMatches(entry: Pick<AvoidedIngredient, "name" | "family">, ingredient: CatalogIngredient) {
  return entry.family ? familyMatches(entry.family, ingredient) : baseOf(ingredient.canonical_name) === baseOf(entry.name);
}

/** Whether any entry covers this catalog ingredient. */
export const isCovered = (entries: Pick<AvoidedIngredient, "name" | "family">[], ingredient: CatalogIngredient) =>
  entries.some((entry) => entryMatches(entry, ingredient));

// Words that describe a food rather than name it ("Ground pork", "Green
// papaya"), never offered as a whole food.
const DESCRIPTIVE = new Set(
  "raw cooked fried dried ground whole native fresh green red white black sweet young mature canned smoked salted instant powdered roasted boiled grilled plain full sliced spring dark low sodium all purpose bone in and with".split(" "),
);

/** The whole food a picked ingredient belongs to, if it's worth offering:
 *  the word in its base name covering the most catalog ingredients, when
 *  that's more than its base name alone covers ("Chicken wing" -> chicken;
 *  "Blue crab" -> crab). The word keeps its catalog spelling ("peanuts"). */
export function suggestFamily<T extends CatalogIngredient>(ingredient: T, catalog: T[]): { family: string; members: T[] } | null {
  const base = baseOf(ingredient.canonical_name);
  const baseCount = catalog.filter((i) => baseOf(i.canonical_name) === base).length;
  let best: { family: string; members: T[] } | null = null;
  for (const raw of ingredient.canonical_name.split(",")[0].toLowerCase().split(/[^a-z]+/)) {
    // It has to cover the picked one itself ("Chicken egg" is an egg).
    if (!raw || DESCRIPTIVE.has(raw) || DESCRIPTIVE.has(norm(raw)) || !familyMatches(raw, ingredient)) continue;
    const members = catalog.filter((i) => familyMatches(raw, i));
    if (members.length > (best?.members.length ?? 0)) best = { family: raw, members };
  }
  return best && best.members.length > baseCount ? best : null;
}

/** "All chicken" for a whole food, else the friendly name ("Ampalaya"),
 *  else the catalog name before its first comma ("Pork belly"). */
export const avoidLabel = (a: Pick<AvoidedIngredient, "name" | "aliases" | "family">) =>
  a.family ? `All ${a.family}` : (a.aliases[0] ?? a.name.split(",")[0]);
