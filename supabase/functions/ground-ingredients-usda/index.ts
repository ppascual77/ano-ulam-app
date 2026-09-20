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

function significantWords(text: string): string[] {
  return text
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((w) => w.length > 2 && !STOPWORDS.has(w));
}

function hasWordOverlap(query: string, description: string): boolean {
  const queryWords = significantWords(query);
  if (queryWords.length === 0) return true; // nothing meaningful left to check
  const descWords = new Set(significantWords(description));
  return queryWords.some((w) => descWords.has(w));
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

function classifyConfidence(score: number): "HIGH" | "LOW" {
  return score >= HIGH_SCORE_THRESHOLD ? "HIGH" : "LOW";
}

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
    const eligible = foods
      .filter((f) => f.score >= LOW_SCORE_THRESHOLD && hasWordOverlap(canonicalName, f.description))
      .sort((a, b) => b.score - a.score)
      .slice(0, MAX_CANDIDATES);

    if (eligible.length === 0) {
      return { id, confidence: "NONE" };
    }

    const fetched: Candidate[] = await Promise.all(
      eligible.map(async (f) => {
        const nutrients = await fetchUsdaFoodDetail(f.fdcId);
        return {
          fdcId: f.fdcId,
          description: f.description,
          dataType: f.dataType,
          score: f.score,
          ...extractNutrients(nutrients),
        };
      }),
    );
    const candidates = fetched.filter(hasUsableNutrients);

    if (candidates.length === 0) {
      return { id, confidence: "NONE" };
    }

    return { id, confidence: classifyConfidence(candidates[0].score), candidates };
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

  // Each ingredient now costs up to MAX_CANDIDATES+1 USDA requests instead
  // of 2 — still fine run concurrently at admin-triggered batch sizes (tens
  // of ingredients); revisit if grounding ever scales to hundreds at once
  // and starts hitting USDA's rate limit.
  const results = await Promise.all(
    ingredients.map(({ id, canonicalName }) => groundOne(id, canonicalName)),
  );

  return new Response(JSON.stringify({ results }), {
    headers: { "Content-Type": "application/json" },
  });
});
