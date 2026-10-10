// Pure USDA FoodData Central search proxy — no DB access. The client already
// knows which ingredients need grounding (from its own loaded/filtered
// list) and sends {id, canonicalName} pairs; this function searches USDA
// for each and returns candidate matches with a confidence tier. It does
// NOT write anything — applying a match to the ingredients table is a
// separate, deliberate client-side action (see
// docs/ingredient-data-architecture.md section 21: grounding must never
// silently overwrite live data).
//
// Returns up to MAX_CANDIDATES per ingredient rather than just the top
// pick — confirmed necessary after "Vinegar, white" tied on score with
// "Vinegar, balsamic", "Vinegar, cider", and "Vinegar, distilled" (365.6
// each); taking array index 0 picked balsamic arbitrarily even though
// "distilled" is the actually-correct match for "white vinegar". The admin
// picks among candidates client-side rather than the function silently
// deciding for them.
//
// The API key stays server-side (set via `supabase secrets set`), never in
// the app bundle.

const USDA_API_KEY = Deno.env.get("USDA_API_KEY");
const USDA_SEARCH_URL = "https://api.nal.usda.gov/fdc/v1/foods/search";
const USDA_FOOD_URL = "https://api.nal.usda.gov/fdc/v1/food";

// USDA FDC's standard nutrient IDs — see https://fdc.nal.usda.gov/. Energy
// and sugar each have more than one possible ID depending on which dataset
// a record comes from (confirmed empirically: a "Foundation" chicken breast
// record used 2047/2048 "Energy (Atwater ...)" instead of the more common
// 1008 "Energy"); first match wins.
const NUTRIENT_IDS = {
  calories: [1008, 2047, 2048],
  protein: [1003],
  carbohydrates: [1005],
  fat: [1004],
  sugar: [2000, 1063],
  fiber: [1079],
  sodium: [1093],
};

// Heuristic thresholds on USDA's relevance `score` — tuned by eye, not an
// official USDA scale. Expect to adjust once real grounding runs show how
// well these actually separate good from bad matches. Score alone is NOT
// sufficient though — see hasWordOverlap below, confirmed necessary after
// a nonsense query still scored high enough to look like a HIGH match.
const HIGH_SCORE_THRESHOLD = 300;
const LOW_SCORE_THRESHOLD = 50;
// How many candidates to surface per ingredient when multiple pass the
// filters — fetching detail for each costs one extra USDA request apiece,
// so this is deliberately small. Revisit if/when grounding scales past a
// handful of ingredients per run (see rate-limit note near the bottom).
const MAX_CANDIDATES = 3;
// Ingredients looked up at once within one call.
const INGREDIENT_CONCURRENCY = 4;
// Excludes "Branded" (specific commercial products) — a canonical
// ingredient should match a generic reference food, not one brand's SKU.
// NOTE: "Survey (FNDDS)" was tried here too, but its parentheses trip a 400
// at USDA's proxy layer (confirmed via direct curl, not just from this
// function) — dropped rather than fighting further encoding of it.
const PREFERRED_DATA_TYPES = ["Foundation", "SR Legacy"];

// USDA's search returns *something* for almost any input, including
// gibberish — confirmed empirically: "asdkjqwlkejqwlke nonsense food"
// scored 313 (above HIGH_SCORE_THRESHOLD) against "Oats ... Food
// Distribution Program", purely because "food" is a generic word shared by
// tons of descriptions. This sanity check requires at least one
// *significant* (non-stopword) query word to actually appear in the
// matched description before trusting the score at all.
const STOPWORDS = new Set([
  "food", "foods", "raw", "cooked", "fried", "dried", "the", "and", "of",
  "for", "includes", "program", "distribution", "usda's", "a", "in", "with",
]);

// Singular base form, so our names match USDA's plurals — confirmed
// necessary: "Apple, raw" was rejected outright because every USDA record
// says "Apples", and "Strawberry, raw" was offered "Guavas, strawberry"
// because the real "Strawberries, raw" failed the exact-word check.
function stem(word: string): string {
  if (word.length > 4 && word.endsWith("ies")) return `${word.slice(0, -3)}y`; // berries -> berry
  if (word.length > 4 && /(oes|ches|shes|xes|sses)$/.test(word)) return word.slice(0, -2); // tomatoes, peaches
  if (word.length > 3 && word.endsWith("s") && !word.endsWith("ss")) return word.slice(0, -1); // apples, lentils
  return word;
}

function significantWords(text: string): string[] {
  return text
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((w) => w.length > 2 && !STOPWORDS.has(w))
    .map(stem);
}

// Brand and restaurant records (SR Legacy has plenty: "DENNY'S, spaghetti
// and meatballs" outranked "Pasta, dry, enriched, spaghetti") spell the
// brand in ALL CAPS; generic records are sentence case. A canonical
// ingredient should never ground to one brand's product.
const BRAND_WORD = /\b[A-Z][A-Z'\u2019]{2,}\b/;

// Preparation state, read from both names. "raw"/"cooked"/"dried" are
// stopwords for the word overlap above (too common to prove a match), but
// they still decide WHICH record is right — confirmed necessary:
// "Spaghetti, dried" picked "Spaghetti, spinach, cooked" and "Kidney
// beans, dried" picked "Beans, liquid from stewed kidney beans", both HIGH.
const STATES: Record<string, string> = {
  raw: "raw", fresh: "raw",
  cooked: "cooked", boiled: "cooked", stewed: "cooked", steamed: "cooked", baked: "cooked",
  roasted: "cooked", fried: "cooked", grilled: "cooked", braised: "cooked", simmered: "cooked",
  dried: "dried", dry: "dried", dehydrated: "dried",
  canned: "canned",
};
// A different FORM of the food than asked for ("liquid from" beans, juice
// instead of fruit, flour instead of grain) whenever ours doesn't name it.
const FORM_WORDS = ["liquid", "juice", "sprouted", "powder", "flour", "oil", "sauce", "frozen", "concentrate", "paste", "seasoned"];

function statesIn(text: string): Set<string> {
  const out = new Set<string>();
  for (const w of text.toLowerCase().split(/[^a-z]+/)) if (STATES[w]) out.add(STATES[w]);
  return out;
}

function hasConflict(query: string, description: string): boolean {
  const q = statesIn(query);
  const d = statesIn(description);
  // Dry-uncooked counts as raw: USDA calls dried beans and lentils "mature
  // seeds, raw" ("Lentils, raw" is dry lentils), so our "dried" accepts its
  // "raw", but never "cooked".
  if (q.has("dried")) q.add("raw");
  if (q.size > 0 && d.size > 0 && ![...q].some((st) => d.has(st))) return true;
  const qText = query.toLowerCase();
  const dText = description.toLowerCase();
  return FORM_WORDS.some((w) => dText.includes(w) && !qText.includes(w));
}

type Relevance = {
  /** The USDA description's lead word (its food: "Beans" in "Beans,
   *  kidney") is one of ours, so it's the same food rather than one that
   *  merely mentions ours ("Guavas, strawberry" for strawberries). Not
   *  "our first word leads": USDA inverts names ("Beans, kidney" for our
   *  "Kidney beans"). */
  headMatch: boolean;
  /** Share of our significant words found in the description. */
  coverage: number;
  /** Description words beyond ours: fewer = the generic record. */
  extraWords: number;
  /** A different preparation state or form than ours (see hasConflict). */
  conflict: boolean;
};

function relevance(query: string, description: string): Relevance {
  const queryWords = significantWords(query);
  const descWords = significantWords(description);
  const descSet = new Set(descWords);
  const found = queryWords.filter((w) => descSet.has(w)).length;
  return {
    headMatch: descWords.length > 0 && queryWords.includes(descWords[0]),
    coverage: queryWords.length === 0 ? 1 : found / queryWords.length,
    extraWords: descWords.filter((w) => !queryWords.includes(w)).length,
    conflict: hasConflict(query, description),
  };
}

function hasWordOverlap(query: string, description: string): boolean {
  if (significantWords(query).length === 0) return true; // nothing meaningful left to check
  return relevance(query, description).coverage > 0;
}

type UsdaSearchFood = { fdcId: number; description: string; dataType: string; score: number };
type UsdaDetailNutrient = { nutrient: { id: number }; amount?: number };

type Candidate = {
  fdcId: number;
  description: string;
  dataType: string;
  score: number;
  calories: number | null;
  protein: number | null;
  carbohydrates: number | null;
  fat: number | null;
  sugar: number | null;
  fiber: number | null;
  sodium: number | null;
};

function pickNutrient(byId: Map<number, number>, ids: number[]): number | null {
  for (const id of ids) {
    const value = byId.get(id);
    if (value !== undefined) return value;
  }
  return null;
}

// The search endpoint's abbreviated foodNutrients list is unreliable for
// basic macros — confirmed empirically: some Foundation records omit
// calories/protein/carbs/fat entirely from the search response despite
// having them available. The detail endpoint (/food/{fdcId}) reliably
// includes them, at the cost of one extra request per candidate.
function extractNutrients(nutrients: UsdaDetailNutrient[]) {
  const byId = new Map(
    nutrients
      .filter((n) => n.amount !== undefined)
      .map((n) => [n.nutrient.id, n.amount as number]),
  );
  return {
    calories: pickNutrient(byId, NUTRIENT_IDS.calories),
    protein: pickNutrient(byId, NUTRIENT_IDS.protein),
    carbohydrates: pickNutrient(byId, NUTRIENT_IDS.carbohydrates),
    fat: pickNutrient(byId, NUTRIENT_IDS.fat),
    sugar: pickNutrient(byId, NUTRIENT_IDS.sugar),
    fiber: pickNutrient(byId, NUTRIENT_IDS.fiber),
    sodium: pickNutrient(byId, NUTRIENT_IDS.sodium),
  };
}

async function searchUsda(query: string): Promise<UsdaSearchFood[]> {
  const url = new URL(USDA_SEARCH_URL);
  url.searchParams.set("api_key", USDA_API_KEY ?? "");
  url.searchParams.set("query", query);
  url.searchParams.set("dataType", PREFERRED_DATA_TYPES.join(","));
  url.searchParams.set("pageSize", "10");

  const res = await fetch(url.toString());
  if (!res.ok) {
    throw new Error(`USDA search failed: ${res.status} ${res.statusText}`);
  }
  const data = await res.json();
  return (data.foods ?? []) as UsdaSearchFood[];
}

async function fetchUsdaFoodDetail(fdcId: number): Promise<UsdaDetailNutrient[]> {
  const url = new URL(`${USDA_FOOD_URL}/${fdcId}`);
  url.searchParams.set("api_key", USDA_API_KEY ?? "");

  const res = await fetch(url.toString());
  if (!res.ok) {
    throw new Error(`USDA food detail failed: ${res.status} ${res.statusText}`);
  }
  const data = await res.json();
  return (data.foodNutrients ?? []) as UsdaDetailNutrient[];
}

// HIGH needs USDA's score AND the same food: its lead word is ours, and
// every one of our words is present. A high score alone trusted "Guavas,
// strawberry" for strawberries; half the words would trust "Vinegar,
// cider" for "Vinegar, cane".
// Also no state/form conflict and at most MAX_EXTRA_WORDS beyond ours:
// HIGH is pre-ticked in the panel, so it has to be the right record, not
// just a related one. Everything else is offered as LOW to pick from.
const MAX_EXTRA_WORDS = 2;
function classifyConfidence(score: number, rel: Relevance): "HIGH" | "LOW" {
  return score >= HIGH_SCORE_THRESHOLD &&
    rel.headMatch &&
    rel.coverage === 1 &&
    !rel.conflict &&
    rel.extraWords <= MAX_EXTRA_WORDS
    ? "HIGH"
    : "LOW";
}

// How far down the ranked list to look for MAX_CANDIDATES records that
// actually carry nutrients ("Mayonnaise, Regular" comes back with every
// macro empty, so the top 3 alone can all be unusable).
const MAX_DETAIL_LOOKUPS = 8;

// This score-only classification only means something if the candidate
// actually HAS usable nutrition data — confirmed necessary after
// "Mayonnaise" and "Ranch dressing" both matched real USDA records
// (textually confident enough to score HIGH) whose detail endpoint
// returned every core macro as null. Applying that "HIGH_CONFIDENCE"
// match overwrote a working manual placeholder with nulls, violating the
// project's own rule that every ingredient field must carry a value.
// Text-match confidence and data completeness are independent signals;
// a candidate with none of the four core macros is never usable
// regardless of how well its description matched the query.
function hasUsableNutrients(c: Pick<Candidate, "calories" | "protein" | "carbohydrates" | "fat">): boolean {
  return c.calories !== null || c.protein !== null || c.carbohydrates !== null || c.fat !== null;
}

type GroundingResult =
  | { id: string; confidence: "NONE" }
  | { id: string; confidence: "ERROR"; error: string }
  | { id: string; confidence: "HIGH" | "LOW"; candidates: Candidate[] };

async function groundOne(id: string, canonicalName: string): Promise<GroundingResult> {
  try {
    const foods = await searchUsda(canonicalName);
    // Same food first (lead word is ours), then same state/form, then more
    // of our words, then the generic record (fewest extra words), then
    // USDA's own score.
    const ranked = foods
      .filter(
        (f) =>
          f.score >= LOW_SCORE_THRESHOLD &&
          !BRAND_WORD.test(f.description) &&
          hasWordOverlap(canonicalName, f.description),
      )
      .map((f) => ({ food: f, rel: relevance(canonicalName, f.description) }))
      .sort(
        (a, b) =>
          Number(b.rel.headMatch) - Number(a.rel.headMatch) ||
          Number(a.rel.conflict) - Number(b.rel.conflict) ||
          b.rel.coverage - a.rel.coverage ||
          a.rel.extraWords - b.rel.extraWords ||
          b.food.score - a.food.score,
      )
      .slice(0, MAX_DETAIL_LOOKUPS);

    if (ranked.length === 0) {
      return { id, confidence: "NONE" };
    }

    // In rank order, a couple at a time, until MAX_CANDIDATES usable ones:
    // skips past records with no nutrients without paying for all 8.
    const candidates: (Candidate & { rel: Relevance })[] = [];
    for (let i = 0; i < ranked.length && candidates.length < MAX_CANDIDATES; i += 2) {
      const fetched = await Promise.all(
        ranked.slice(i, i + 2).map(async ({ food: f, rel }) => ({
          fdcId: f.fdcId,
          description: f.description,
          dataType: f.dataType,
          score: f.score,
          rel,
          ...extractNutrients(await fetchUsdaFoodDetail(f.fdcId)),
        })),
      );
      candidates.push(...fetched.filter(hasUsableNutrients));
    }

    if (candidates.length === 0) {
      return { id, confidence: "NONE" };
    }

    const top = candidates.slice(0, MAX_CANDIDATES);
    return {
      id,
      confidence: classifyConfidence(top[0].score, top[0].rel),
      candidates: top.map(({ rel: _rel, ...c }) => c),
    };
  } catch (err) {
    return { id, confidence: "ERROR", error: err instanceof Error ? err.message : String(err) };
  }
}

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "POST only" }), { status: 405 });
  }
  if (!USDA_API_KEY) {
    return new Response(JSON.stringify({ error: "USDA_API_KEY not configured" }), { status: 500 });
  }

  const body = await req.json();
  const ingredients = body?.ingredients as { id: string; canonicalName: string }[] | undefined;
  if (!Array.isArray(ingredients)) {
    return new Response(JSON.stringify({ error: "ingredients must be an array" }), { status: 400 });
  }

  // A few ingredients at a time, not all at once: each costs ~4 USDA
  // requests, and a 250-ingredient burst (~1,000 requests) hit USDA's
  // hourly key limit, coming back as ERROR. The client also sends small
  // batches (api/ingredients.ts groundIngredientsUsda).
  const results: GroundingResult[] = [];
  for (let i = 0; i < ingredients.length; i += INGREDIENT_CONCURRENCY) {
    results.push(
      ...(await Promise.all(
        ingredients
          .slice(i, i + INGREDIENT_CONCURRENCY)
          .map(({ id, canonicalName }) => groundOne(id, canonicalName)),
      )),
    );
  }

  return new Response(JSON.stringify({ results }), {
    headers: { "Content-Type": "application/json" },
  });
});
