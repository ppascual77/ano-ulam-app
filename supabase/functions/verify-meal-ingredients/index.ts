// AI audit of a meal's ALREADY-manually-linked ingredient list, run from
// SeedMealScreen once the admin has finished matching/bridging every
// ingredient by hand — matching/bridging itself is untouched by this and
// stays 100% manual (every match/bridge trigger in SeedMealIngredientsEditor
// is admin-initiated, this never re-links or creates an ingredient). This
// reviews the RESULT: does the total price/macros look plausible, does each
// ingredient's computed contribution look right, do its bridge/price-unit/
// state fields actually make sense for this specific food and recipe.
//
// Returns proposed field-level fixes on the ALREADY-LINKED ingredient only —
// never a suggestion to re-link to a different ingredient or create a new
// one (out of scope; a human catches that in the final manual review).
// Writes nothing itself — same "grounding never silently applies" principle
// as this project's other AI features. The admin accepts or skips each
// issue individually in MealVerifyPanel; only an accepted fix is written,
// via the normal updateIngredient path (also cascades to every other meal
// using that ingredient, same as any other ingredient edit).

const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
const OPENAI_URL = "https://api.openai.com/v1/chat/completions";

type VerifyIngredientInput = {
  name: string;
  displayText: string;
  quantityAmount: number | null;
  quantityUnit: string | null;
  role: string | null;
  category: string | null;
  state: string | null;
  basisAmount: number;
  basisUnit: string;
  calories: number | null;
  protein: number | null;
  carbohydrates: number | null;
  fat: number | null;
  sugar: number | null;
  fiber: number | null;
  sodium: number | null;
  estimatedPrice: number | null;
  estimatedPriceUnit: string | null;
  gramsPerMl: number | null;
  gramsPerPiece: number | null;
  pieceLabel: string | null;
  computed: {
    calories: number | null;
    protein: number | null;
    carbohydrates: number | null;
    fat: number | null;
    price: number | null;
  };
};

type VerifyMealInput = {
  name: string;
  description: string | null;
  servingSize: number;
  category: string | null;
};

type VerifyIssue = {
  ingredientName: string;
  field:
    | "calories" | "protein" | "carbohydrates" | "fat" | "sugar" | "fiber" | "sodium"
    | "estimated_price" | "estimated_price_unit" | "grams_per_ml" | "grams_per_piece"
    | "piece_label" | "state";
  issue: string;
  currentValue: string;
  suggestedValue: string;
  reasoning: string;
};

type VerifyResult = {
  summary: string;
  overallAssessment: "plausible" | "concerning";
  issues: VerifyIssue[];
};

const SYSTEM_PROMPT = `You are auditing an already-assembled Filipino home-cooking recipe (AnoUlam meal-seeding admin tool). Every ingredient below was ALREADY manually matched to a real ingredient record and quantity-bridged by a human admin — you are NOT matching, linking, re-linking, or creating any ingredient. Your only job is to sanity-check the RESULT and flag concrete data problems on the ALREADY-LINKED ingredient rows given to you.

For each ingredient you're given: its name, the recipe's own stated quantity ("displayText", e.g. "14 oz can, drained"), the resolved quantity/unit actually used for calculation, its full per-basisAmount nutrition + price + grams_per_ml/grams_per_piece bridge fields, and its COMPUTED contribution to this recipe at this quantity ("computed": calories/protein/carbohydrates/fat/price).

CHECK FOR:
1. State/description mismatch: does the linked ingredient's state/macros genuinely match what displayText says (e.g. displayText says "canned, drained" or "cooked" but the linked row's macros look like a raw/dry variant — raw dry legumes run roughly 3x the calories of their canned/drained form per equal weight; raw meat/fish differs substantially from cooked/fried). If you suspect this, flag the affected macro field(s) with your best real-world estimate for what the CORRECT state should show — not a copy of the current wrong value.
2. Implausible bridge values: does grams_per_piece (weight of ONE piece/pieceLabel) or grams_per_ml (weight of 1ml) look like a realistic real-world figure for this specific food? E.g. a garlic clove should be roughly 3-6g, not 200g; olive oil should be roughly 0.91-0.92 g/ml, not 1.5.
3. Price-unit domain mismatch: estimatedPriceUnit must be a weight unit ("g"/"kg") when basisUnit is "g", or a volume unit ("ml"/"L") when basisUnit is "ml" — a mismatch silently breaks price calculation for every meal using this ingredient.
4. Atwater sanity: calories should be close to protein*4 + carbohydrates*4 + fat*9 per basisAmount, UNLESS this is one of the known Atwater-exception ingredients (vinegar, cocoa/cacao, coffee, wine, vanilla extract, gulaman/agar-agar).
5. Disproportionate computed contribution: does a "pantry"-role ingredient's computed calorie/price contribution look absurdly large relative to its role (e.g. a garnish/seasoning outweighing the main protein) — this usually signals a unit/bridge/quantity error, not a genuinely large amount.
6. Overall plausibility: given the recipe's name/description/category and serving size, does the TOTAL computed calories and price PER SERVING look realistic for a Filipino home-cooked dish of this kind (assume Filipino home-market portions and pricing, not Western/restaurant-scale assumptions).

Only flag REAL, concrete issues you have genuine reason to suspect from the data given — do not invent nitpicks, do not flag ordinary estimation variance. If everything looks fine, return an empty "issues" array and overallAssessment "plausible". Never propose anything outside these exact fields: calories, protein, carbohydrates, fat, sugar, fiber, sodium, estimated_price, estimated_price_unit, grams_per_ml, grams_per_piece, piece_label, state — always a corrected VALUE for a field already on the ingredient given, never a suggestion to use a different ingredient entirely.

OUTPUT SHAPE — return ONLY a JSON object (no markdown fences) matching exactly:
{
  "summary": string,
  "overallAssessment": "plausible" | "concerning",
  "issues": [
    {
      "ingredientName": string,
      "field": "calories" | "protein" | "carbohydrates" | "fat" | "sugar" | "fiber" | "sodium" | "estimated_price" | "estimated_price_unit" | "grams_per_ml" | "grams_per_piece" | "piece_label" | "state",
      "issue": string,
      "currentValue": string,
      "suggestedValue": string,
      "reasoning": string
    }
  ]
}`;

async function verifyWithOpenAI(
  meal: VerifyMealInput,
  ingredients: VerifyIngredientInput[],
  totals: unknown,
): Promise<VerifyResult> {
  if (!OPENAI_API_KEY) throw new Error("OPENAI_API_KEY not configured");

  const res = await fetch(OPENAI_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${OPENAI_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      response_format: { type: "json_object" },
      temperature: 0.2,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: JSON.stringify({ meal, ingredients, totals }) },
      ],
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`OpenAI request failed: ${res.status} ${body}`);
  }

  const data = await res.json();
  const raw = data.choices?.[0]?.message?.content;
  if (!raw) throw new Error("OpenAI returned no content");

  const parsed = JSON.parse(raw);
  return {
    summary: typeof parsed.summary === "string" ? parsed.summary : "",
    overallAssessment: parsed.overallAssessment === "concerning" ? "concerning" : "plausible",
    issues: Array.isArray(parsed.issues) ? parsed.issues : [],
  };
}

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "POST only" }), { status: 405 });
  }
  if (!OPENAI_API_KEY) {
    return new Response(JSON.stringify({ error: "OPENAI_API_KEY not configured" }), { status: 500 });
  }

  try {
    const body = await req.json();
    const meal = body?.meal as VerifyMealInput | undefined;
    const ingredients = body?.ingredients as VerifyIngredientInput[] | undefined;
    const totals = body?.totals;
    if (!meal || !ingredients || ingredients.length === 0) {
      return new Response(JSON.stringify({ error: "meal and ingredients are required" }), { status: 400 });
    }

    const verification = await verifyWithOpenAI(meal, ingredients, totals);

    return new Response(JSON.stringify({ verification }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return new Response(JSON.stringify({ error: message }), { status: 422 });
  }
});
