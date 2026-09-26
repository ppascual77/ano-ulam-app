// AI-curated ingredient data, in two modes:
//
// 1. Full estimate (no `known`) — the meal seeder's fallback when an
//    ingredient has no match in the ingredients table AND no confident USDA
//    candidate. The LLM estimates every field from scratch.
// 2. Gap-fill (`known` present) — the meal seeder's USDA "Add + use" path
//    creates a new ingredient row from real USDA nutrition data, but USDA
//    has no concept of this app's operational fields (role, category,
//    price, piece-count bridge). Those were being left null/blank, which
//    silently zeroes an ingredient out of a meal's totals if the recipe
//    quantifies it by piece and there's no grams_per_piece bridge, or if a
//    price was never set. This mode keeps the given USDA nutrition as-is
//    and only asks the LLM to fill in the fields USDA doesn't cover — same
//    principle as this project's whole ingredient database: every field
//    carries a real value, never left blank for "later".
//
// Either way this returns a DRAFT only — same "grounding never silently
// applies" principle as ground-ingredients-usda and import-meal-from-url.
// The full-estimate mode is reviewed/edited in IngredientEditSheet then
// confirmed before anything is written; the gap-fill mode is applied as a
// patch to an already-created row (see SeedMealIngredientsEditor's
// handleAddAndUse), with the admin free to correct it afterward in the
// normal edit sheet like any other field.
//
// source/verification_status/price_source are NOT the LLM's call — fixed
// client-side to 'manual'/'NEEDS_REVIEW'/'manual' (or 'USDA' for the
// nutrition fields in gap-fill mode), identical to how the ~500 canonical
// ingredients were batch-seeded this project: an AI estimate is honestly
// tagged as needing review, never presented as verified data.

const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
const OPENAI_URL = "https://api.openai.com/v1/chat/completions";

type IngredientEstimate = {
  canonical_name: string;
  display_name: string | null;
  aliases: string[];
  category: string;
  food_group: string;
  role: "main" | "pantry";
  state: "raw" | "cooked" | "fried" | "dried" | null;
  basis_amount: number;
  basis_unit: "g" | "ml";
  calories: number;
  protein: number;
  carbohydrates: number;
  fat: number;
  sugar: number;
  fiber: number;
  sodium: number;
  estimated_price: number;
  estimated_price_unit: string;
  grams_per_ml: number | null;
  grams_per_piece: number | null;
  piece_label: string | null;
};

type KnownNutrition = {
  basis_amount: number;
  basis_unit: string;
  calories: number | null;
  protein: number | null;
  carbohydrates: number | null;
  fat: number | null;
  sugar: number | null;
  fiber: number | null;
  sodium: number | null;
};

const BASE_PROMPT = `You estimate data for a single food ingredient, for a Filipino home-cooking app's canonical ingredients database (AnoUlam). Your output becomes a draft row an admin reviews and corrects before saving — never invent false precision, but every field must carry a real best-estimate value, never left blank/null unless the field is genuinely not applicable.

CONVENTIONS (match this database's existing ~500 seeded ingredients):
- category/food_group: short free-text groupings (e.g. category "Vinegar", food_group "Condiment"; category "Leafy vegetable", food_group "Vegetable"). Use Filipino-market-relevant groupings.
- aliases: include common Filipino/Tagalog names alongside English ones when applicable (e.g. "suka" for vinegar, "toyo" for soy sauce), plus common alternate spellings.
- role: "main" for a substantial ingredient a dish is built around (proteins, vegetables, staples), "pantry" for seasonings/condiments/oils/spices used in small quantities.
- state: "raw" | "cooked" | "fried" | "dried" | null — null only when state genuinely doesn't apply (e.g. a liquid condiment).
- estimated_price/estimated_price_unit: realistic Philippine peso (PHP) wet-market/grocery pricing. estimated_price_unit MUST be exactly "g", "kg", "ml", or "L" — never "piece"/"pack"/"bundle"/etc, since the app has no gram conversion bridge for a discrete unit. For an ingredient normally sold/priced by piece (egg, clove, sheet), estimate its typical per-piece weight instead and express price per "kg" (e.g. garlic priced ~₱280/kg, with grams_per_piece ~5 for one clove) — same approach already used for this database's other per-piece ingredients.
- grams_per_ml: only set (non-null) when this ingredient bridges weight/volume in a way the app needs (e.g. a liquid whose macros are stored per-gram but commonly measured by volume); otherwise null.
- grams_per_piece + piece_label: set BOTH whenever a recipe could plausibly quantify this ingredient by count — this includes whole produce (a tomato, an onion, a fruit) AND individual meat/fish/poultry portions (a fillet, a chicken thigh, a chop, a whole egg) just as much as countable pantry items (egg, clove, sheet, bundle). If a recipe could ever say "4 pieces" or "4 fillets" of this ingredient, it needs this bridge. A missing bridge means the app silently computes ZERO for this ingredient's contribution to a meal's price/macros no matter how good the rest of the data is — for a main-dish protein this is the single most damaging field to leave null. Leave both null only when piece-counting genuinely never applies (liquids, ground spices, granular staples like rice/sugar).`;

function fullEstimatePrompt(): string {
  return `${BASE_PROMPT}
- basis_amount/basis_unit: almost always 100 with basis_unit "g" for solids or "ml" for liquids — macros are PER that basis.
- calories/protein/carbohydrates/fat/sugar/fiber/sodium: realistic estimates per basis_amount basis_unit. Sanity-check with Atwater math (calories ≈ protein*4 + carbohydrates*4 + fat*9) UNLESS the ingredient is one of the known exceptions where Atwater doesn't apply cleanly: vinegar, cocoa/cacao, coffee, wine, vanilla extract, gulaman/agar-agar.

OUTPUT SHAPE — return ONLY a JSON object (no markdown fences) matching exactly:
{
  "canonical_name": string,
  "display_name": string | null,
  "aliases": string[],
  "category": string,
  "food_group": string,
  "role": "main" | "pantry",
  "state": "raw" | "cooked" | "fried" | "dried" | null,
  "basis_amount": number,
  "basis_unit": "g" | "ml",
  "calories": number,
  "protein": number,
  "carbohydrates": number,
  "fat": number,
  "sugar": number,
  "fiber": number,
  "sodium": number,
  "estimated_price": number,
  "estimated_price_unit": "g" | "kg" | "ml" | "L",
  "grams_per_ml": number | null,
  "grams_per_piece": number | null,
  "piece_label": string | null
}

If the given name isn't a real, identifiable food ingredient, return {"error": "reason"} instead.`;
}

function gapFillPrompt(known: KnownNutrition): string {
  return `${BASE_PROMPT}

The nutrition values below are ALREADY VERIFIED from USDA for this ingredient — echo them back completely unchanged in your output (including basis_amount/basis_unit). Do not re-estimate or adjust them. Your job is ONLY to fill in the operational fields USDA doesn't provide: display_name, aliases, category, food_group, role, state, estimated_price, estimated_price_unit, grams_per_ml, grams_per_piece, piece_label.

Known verified nutrition (per ${known.basis_amount} ${known.basis_unit}):
${JSON.stringify({ calories: known.calories, protein: known.protein, carbohydrates: known.carbohydrates, fat: known.fat, sugar: known.sugar, fiber: known.fiber, sodium: known.sodium })}

OUTPUT SHAPE — return ONLY a JSON object (no markdown fences) matching exactly, with the nutrition fields set to the known values above unchanged:
{
  "canonical_name": string,
  "display_name": string | null,
  "aliases": string[],
  "category": string,
  "food_group": string,
  "role": "main" | "pantry",
  "state": "raw" | "cooked" | "fried" | "dried" | null,
  "basis_amount": ${known.basis_amount},
  "basis_unit": "${known.basis_unit}",
  "calories": ${known.calories},
  "protein": ${known.protein},
  "carbohydrates": ${known.carbohydrates},
  "fat": ${known.fat},
  "sugar": ${known.sugar},
  "fiber": ${known.fiber},
  "sodium": ${known.sodium},
  "estimated_price": number,
  "estimated_price_unit": "g" | "kg" | "ml" | "L",
  "grams_per_ml": number | null,
  "grams_per_piece": number | null,
  "piece_label": string | null
}

If the given name isn't a real, identifiable food ingredient, return {"error": "reason"} instead.`;
}

async function estimateWithOpenAI(name: string, known?: KnownNutrition): Promise<IngredientEstimate> {
  if (!OPENAI_API_KEY) throw new Error("OPENAI_API_KEY not configured");

  const systemPrompt = known ? gapFillPrompt(known) : fullEstimatePrompt();

  const res = await fetch(OPENAI_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${OPENAI_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      response_format: { type: "json_object" },
      temperature: 0.3,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: `Ingredient name: ${name}` },
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
  if (parsed.error) throw new Error(`Could not estimate this ingredient: ${parsed.error}`);
  return parsed as IngredientEstimate;
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
    const name = body?.name as string | undefined;
    const known = body?.known as KnownNutrition | undefined;
    if (!name || !name.trim()) {
      return new Response(JSON.stringify({ error: "name is required" }), { status: 400 });
    }

    const ingredient = await estimateWithOpenAI(name.trim(), known);

    return new Response(JSON.stringify({ ingredient }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return new Response(JSON.stringify({ error: message }), { status: 422 });
  }
});
