// AI-curated fallback for the meal seeder: when an ingredient a recipe
// calls for has no match in the ingredients table AND no confident USDA
// candidate, this asks an LLM to estimate a full ingredient record instead
// of leaving the admin to type every field from scratch. Returns a DRAFT
// only — same "grounding never silently applies" principle as
// ground-ingredients-usda and import-meal-from-url. The admin reviews/edits
// every field in IngredientEditSheet, then explicitly confirms before
// anything is written to the database.
//
// source/verification_status/price_source are NOT the LLM's call — fixed
// here to 'manual'/'NEEDS_REVIEW'/'manual', identical to how the ~500
// canonical ingredients were batch-seeded this project: an AI estimate is
// honestly tagged as needing review, never presented as verified data.

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

const SYSTEM_PROMPT = `You estimate nutrition and pricing data for a single food ingredient, for a Filipino home-cooking app's canonical ingredients database (AnoUlam). Your output becomes a draft row an admin reviews and corrects before saving — never invent false precision, but every field must carry a real best-estimate value, never left blank/null unless the field is genuinely not applicable.

CONVENTIONS (match this database's existing ~500 seeded ingredients):
- category/food_group: short free-text groupings (e.g. category "Vinegar", food_group "Condiment"; category "Leafy vegetable", food_group "Vegetable"). Use Filipino-market-relevant groupings.
- aliases: include common Filipino/Tagalog names alongside English ones when applicable (e.g. "suka" for vinegar, "toyo" for soy sauce), plus common alternate spellings.
- role: "main" for a substantial ingredient a dish is built around (proteins, vegetables, staples), "pantry" for seasonings/condiments/oils/spices used in small quantities.
- state: "raw" | "cooked" | "fried" | "dried" | null — null only when state genuinely doesn't apply (e.g. a liquid condiment).
- basis_amount/basis_unit: almost always 100 with basis_unit "g" for solids or "ml" for liquids — macros are PER that basis.
- calories/protein/carbohydrates/fat/sugar/fiber/sodium: realistic estimates per basis_amount basis_unit. Sanity-check with Atwater math (calories ≈ protein*4 + carbohydrates*4 + fat*9) UNLESS the ingredient is one of the known exceptions where Atwater doesn't apply cleanly: vinegar, cocoa/cacao, coffee, wine, vanilla extract, gulaman/agar-agar.
- estimated_price/estimated_price_unit: realistic Philippine peso (PHP) wet-market/grocery pricing, with a sensible unit for how it's actually sold (e.g. "kg", "L", "piece", "pack", "bundle", "sachet").
- grams_per_ml: only set (non-null) when this ingredient bridges weight/volume in a way the app needs (e.g. a liquid whose macros are stored per-gram but commonly measured by volume); otherwise null.
- grams_per_piece + piece_label: only set both when this ingredient is commonly counted by piece (e.g. egg, clove, sheet, bundle); otherwise both null.

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
  "estimated_price_unit": string,
  "grams_per_ml": number | null,
  "grams_per_piece": number | null,
  "piece_label": string | null
}

If the given name isn't a real, identifiable food ingredient, return {"error": "reason"} instead.`;

async function estimateWithOpenAI(name: string): Promise<IngredientEstimate> {
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
      temperature: 0.3,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
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
    if (!name || !name.trim()) {
      return new Response(JSON.stringify({ error: "name is required" }), { status: 400 });
    }

    const ingredient = await estimateWithOpenAI(name.trim());

    return new Response(JSON.stringify({ ingredient }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return new Response(JSON.stringify({ error: message }), { status: 422 });
  }
});
