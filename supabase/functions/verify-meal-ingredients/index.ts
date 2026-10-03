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
// A USDA-sourced ingredient's nutrition is real, already-verified reference
// data — never a proposed fix target; only its price/bridge fields are in
// scope for those (see the SOURCE rule in SYSTEM_PROMPT). The client
// (api/meals.ts's isMealVerifyFieldAllowedForSource) enforces this too, in
// case a response ever ignores the instruction.
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
  // "USDA" means the nutrition fields (calories through sodium) plus state
  // came from a real USDA match, not an estimate — see the CHECK FOR
  // instructions below: those fields are off-limits for this source, only
  // price/bridge fields are checked.
  source: string | null;
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
    | "piece_label" | "state" | "role";
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

For each ingredient you're given: its name, the recipe's own stated quantity ("displayText", e.g. "14 oz can, drained"), the resolved quantity/unit actually used for calculation, its source ("USDA" or "manual"/null), its full per-basisAmount nutrition + price + grams_per_ml/grams_per_piece bridge fields, and its COMPUTED contribution to this recipe at this quantity ("computed": calories/protein/carbohydrates/fat/price).

SOURCE GOVERNS WHICH FIELDS YOU MAY TOUCH — read this before anything else:
- source is exactly "USDA": its nutrition (calories, protein, carbohydrates, fat, sugar, fiber, sodium) and state came from a real, already-verified USDA match. These are NEVER wrong in a way you get to correct — do not flag them, do not run checks 1 or 6 on this ingredient, no matter how implausible a number looks. You may ONLY flag this ingredient's estimated_price, estimated_price_unit, grams_per_piece, grams_per_ml, piece_label, or role (checks 2, 3, 4, 5, 9, and the price/bridge angle of 7). If a USDA ingredient's computed contribution looks wrong, the cause must be the price/bridge/quantity/role side, not its macros — say so in "issue" but only propose a fix on one of those fields.
- source is "manual", null, or anything else: run the full CHECK FOR list below, any field is fair game.

CHECK FOR:
1. State/description mismatch (manual-source ingredients only): does the linked ingredient's state/macros genuinely match what displayText says (e.g. displayText says "canned, drained" or "cooked" but the linked row's macros look like a raw/dry variant — raw dry legumes run roughly 3x the calories of their canned/drained form per equal weight; raw meat/fish differs substantially from cooked/fried). If you suspect this, flag the affected macro field(s) with your best real-world estimate for what the CORRECT state should show — not a copy of the current wrong value.
2. Implausible bridge values (any source): does grams_per_piece (weight of ONE piece/pieceLabel) or grams_per_ml (weight of 1ml) look like a realistic real-world figure for this specific food? E.g. a garlic clove should be roughly 3-6g, not 200g; olive oil should be roughly 0.91-0.92 g/ml, not 1.5.
3. Price-unit DOMAIN mismatch ONLY (any source) — this is not about matching basisUnit exactly: "g" and "kg" are BOTH valid weight units and completely interchangeable with each other (the app already converts between them correctly), same for "ml" and "L" as volume units. NEVER flag estimatedPriceUnit just because it differs from basisUnit when both are the same domain (e.g. basisUnit "g" with estimatedPriceUnit "kg" is CORRECT, not an issue — that's how almost every solid ingredient in this database is priced, since wet-market goods are normally sold/priced per kilo, not per gram). Only flag this when the domain itself is wrong — a WEIGHT unit ("g"/"kg") on a LIQUID ingredient (basisUnit "ml"), or a VOLUME unit ("ml"/"L") on a SOLID ingredient (basisUnit "g") — that's the only case that actually breaks price calculation. This true cross-domain case is rare; when you do find one, you MUST propose two issues together for that ingredient: one with field "estimated_price_unit" (the corrected domain-appropriate unit) AND one with field "estimated_price" (a freshly-estimated realistic price in that new unit — never reuse the old number, it was priced in a different domain and means nothing under the new one).
4. Implausible price MAGNITUDE for its unit (any source) — separate from the domain check above, and this is the one that actually catches most real pricing bugs: does estimated_price make sense as a price for ONE SINGLE unit of estimated_price_unit? A "g" or "ml" price is per one gram/one milliliter — almost nothing in Philippine home cooking costs more than a few pesos for that little (except real luxury items like saffron). estimated_price above roughly 10-15 with estimated_price_unit "g" or "ml" is almost always a "kg"/"L"-scale number that was mistakenly saved with a "g"/"ml" unit instead (e.g. estimated_price 250 with estimated_price_unit "g" implausibly means ₱250 for a single gram of that food — button mushrooms, chicken, rice, anything ordinary is never priced that way; ₱250/kg is the normal reading of that same number). When you find this, propose fixing estimated_price_unit to the "kg"/"L" equivalent of its current unit and KEEP THE SAME estimated_price number — the number was already right, only the unit was too fine-grained. This is different from check 3: no domain change, no new price number, just correcting "g" to "kg" (or "ml" to "L") when the existing number only makes sense at that coarser scale.
5. Implausibly LOW computed price for the quantity used (any source; USDA ingredients only via price/bridge fields) — the flip side of check 4, and just as common a bug: does computed.price look unrealistically cheap for a REAL amount of this specific food, given the actual quantity used in this recipe? E.g. ₱2 for 500g of pork, ₱1 for a whole chicken thigh, ₱0.50 for a cup of rice, ₱3 for 3 tablespoons of cooking oil — all implausibly low for real Philippine market pricing, even for humble ingredients. Two different root causes produce this, and you have to figure out which one actually applies here before proposing a fix:
   (a) estimated_price itself is just too low for what it claims to be priced per (e.g. chicken at ₱4/kg instead of a realistic ₱150-200/kg) — propose a corrected estimated_price, same unit, a realistic number.
   (b) estimated_price is actually fine, but grams_per_piece or grams_per_ml is set far too small, silently converting the recipe's stated quantity down to almost nothing (e.g. a "medium onion" bridge of 3g instead of a realistic ~110g means "1 piece" computes as if it were a few grains of onion) — propose a corrected bridge field instead (see check 2), not the price.
   Only propose a fix for whichever one is actually implausible on its own terms — don't flag both just because the final number looks low.
6. Atwater sanity (manual-source ingredients only): calories should be close to protein*4 + carbohydrates*4 + fat*9 per basisAmount, UNLESS this is one of the known Atwater-exception ingredients (vinegar, cocoa/cacao, coffee, wine, vanilla extract, gulaman/agar-agar).
7. Disproportionate computed contribution (any source, but the fix must respect the SOURCE rule above): does an ingredient's computed calorie/price contribution look absurdly large relative to its role/quantity (e.g. a garnish/seasoning outweighing the main protein, or a "main" ingredient's price dwarfing the rest of the recipe combined) — this usually signals a unit/bridge/price-magnitude error (see checks 4-5), not a genuinely large amount.
8. Overall plausibility: given the recipe's name/description/category and serving size, does the TOTAL computed calories and price PER SERVING look realistic for a Filipino home-cooked dish of this kind (assume Filipino home-market portions and pricing, not Western/restaurant-scale assumptions). This is informational for the summary — it doesn't by itself justify a per-ingredient fix on a USDA ingredient's macros.
9. Role is a display label only (any source) — "main" vs "pantry" just controls the Main/Pantry tag shown next to an ingredient; EVERY ingredient's contribution counts toward the meal's totals regardless of role. Only flag role when it's clearly wrong for how this recipe uses the ingredient (e.g. 20oz of canned pineapple in a dish named for pineapple tagged "pantry"), propose suggestedValue "main", and treat it as low priority. Never propose "main" to "pantry".

Only flag REAL, concrete issues you have genuine reason to suspect from the data given — do not invent nitpicks, do not flag ordinary estimation variance. If everything looks fine, return an empty "issues" array and overallAssessment "plausible". Never propose anything outside these exact fields: calories, protein, carbohydrates, fat, sugar, fiber, sodium, estimated_price, estimated_price_unit, grams_per_ml, grams_per_piece, piece_label, state, role — always a corrected VALUE for a field already on the ingredient given, never a suggestion to use a different ingredient entirely. And never one of the nutrition/state fields for a "USDA"-source ingredient, per the SOURCE rule above.

SUGGESTED VALUE FORMAT — "suggestedValue" is written straight into the database column, so it must be the bare value only, no currency symbols, units, ranges, or explanation (put those in "reasoning"):
- calories, protein, carbohydrates, fat, sugar, fiber, sodium, estimated_price, grams_per_ml, grams_per_piece: a single plain number, e.g. "250" or "0.92" — never "₱250", "250/kg", "0.92 g/ml", or "0.91-0.92".
- estimated_price_unit: exactly one of "g", "kg", "ml", "L".
- role: exactly "main" or "pantry".
- state: exactly one of "raw", "cooked", "fried", "dried".
- piece_label: a short lowercase noun, e.g. "clove", "piece", "medium onion".

OUTPUT SHAPE — return ONLY a JSON object (no markdown fences) matching exactly:
{
  "summary": string,
  "overallAssessment": "plausible" | "concerning",
  "issues": [
    {
      "ingredientName": string,
      "field": "calories" | "protein" | "carbohydrates" | "fat" | "sugar" | "fiber" | "sodium" | "estimated_price" | "estimated_price_unit" | "grams_per_ml" | "grams_per_piece" | "piece_label" | "state" | "role",
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
