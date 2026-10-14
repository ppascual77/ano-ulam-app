// The typical retail pack of packaged ingredients with no store listing
// (condiments, spices, oils, dry goods), for the grocery list's whole
// packs: "Typically ~₱38 per 385 ml bottle".
//
// Returns only the pack SIZE, never a price. The app prices the pack from
// the ingredient's own per-kg/L price (api/ingredients.ts buildPackEstimate),
// so an estimate can't move the ingredient's price. A DRAFT: nothing is
// written until the admin reviews and confirms it in the Pack Estimates tab.
//
// No web search: a typical pack size is general knowledge, so one cheap
// call covers a whole batch.

const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
const OPENAI_URL = "https://api.openai.com/v1/chat/completions";
// Mirrored by PACK_ESTIMATE_MAX_PER_CALL in api/ingredients.ts.
const MAX_PER_CALL = 25;

type Input = { id: string; name: string; category: string | null; priceUnit: "kg" | "L" | null };

type Result =
  | { id: string; packSize: number; packUnit: "g" | "ml"; container: string; example: string | null }
  | { id: string; error: string };

const PROMPT = `You give the typical retail pack of grocery ingredients as sold in Philippine supermarkets (SM, Puregold, Robinsons, Landers), for a Filipino home-cooking app's grocery list.

For each ingredient, pick the pack size an ordinary household most commonly buys for everyday cooking: the regular shelf size, not bulk/institutional packs, and not single-use sachets unless sachets are genuinely how it's normally bought (e.g. some seasonings). Prefer the size of the leading local brand.

Philippine packs are SMALLER than Western ones. Typical sizes to anchor on:
- Dried spices, herbs and seeds (cardamom, fennel, cumin, mustard seed, star anise, oregano, bay leaf): 10-50 g sachets or small bottles, never 100 g+.
- Bouillon / broth cubes: a pack of 6 cubes (about 60 g); 10 g per cube.
- Gravy, sauce and seasoning mixes (gravy, sinigang, kare-kare, menudo): powder sachets of 20-50 g, not bottles of liquid.
- Gulaman / agar: 25 g bars or sachets. Gelatin: 10-30 g sachets.
- Bottled sauces (soy sauce, vinegar, fish sauce, oyster sauce, sweet chili, sweet and sour): 150-385 ml for everyday use; 1 L only for staples like soy sauce and vinegar.
- Cooking oils: 1 L. Specialty oils (sesame, annatto): 100-250 ml.
- Dried legumes, flour, sugar, grits, tapioca: 250-500 g. Snacks and chips: 60-150 g.
When unsure between two common sizes, pick the smaller everyday one.

Rules:
- packUnit is "ml" for liquids and sauces sold by volume, "g" for anything sold by weight (pastes, powders, spices, dry goods, mayonnaise in jars sold by weight). Use the unit printed on the pack.
- packSize is a number in that unit (385, 1000, 50). Never a range.
- container is one plain word: bottle, pack, jar, can, pouch, sachet, box, tub, bag, tube.
- example is a short real product at that size, e.g. "Datu Puti Vinegar 385 ml", or null. Only name a brand and product you're confident is actually sold in the Philippines at that size; never pair a brand with a product it doesn't make (no "Purefoods Lard", no "Kraft Molasses"). null is always better than a guess.
- If the item isn't something sold in a pack at all (homemade, bought loose, a cooked dish), return {"id", "error": "short reason"} for it instead.

Return ONLY a JSON object: {"results": [{"id": string, "packSize": number, "packUnit": "g" | "ml", "container": string, "example": string | null} | {"id": string, "error": string}]}, one entry per input id, same ids.`;

function isValid(r: unknown): r is Result {
  if (!r || typeof r !== "object") return false;
  const o = r as Record<string, unknown>;
  if (typeof o.id !== "string") return false;
  if (typeof o.error === "string") return true;
  return (
    typeof o.packSize === "number" &&
    o.packSize > 0 &&
    (o.packUnit === "g" || o.packUnit === "ml") &&
    typeof o.container === "string" &&
    o.container.trim().length > 0
  );
}

async function estimate(items: Input[]): Promise<Result[]> {
  const res = await fetch(OPENAI_URL, {
    method: "POST",
    headers: { Authorization: `Bearer ${OPENAI_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      response_format: { type: "json_object" },
      temperature: 0.2,
      messages: [
        { role: "system", content: PROMPT },
        {
          role: "user",
          content: JSON.stringify(items.map(({ id, name, category, priceUnit }) => ({ id, name, category, pricedPer: priceUnit }))),
        },
      ],
    }),
  });
  if (!res.ok) throw new Error(`OpenAI request failed: ${res.status} ${await res.text()}`);

  const data = await res.json();
  const raw = data.choices?.[0]?.message?.content;
  if (!raw) throw new Error("OpenAI returned no content");
  const parsed = JSON.parse(raw);
  const byId = new Map<string, Result>();
  for (const r of Array.isArray(parsed.results) ? parsed.results : []) {
    if (isValid(r)) {
      byId.set(
        r.id,
        "error" in r
          ? { id: r.id, error: r.error }
          : {
              id: r.id,
              packSize: r.packSize,
              packUnit: r.packUnit,
              container: r.container.trim().toLowerCase(),
              example: typeof r.example === "string" && r.example.trim() ? r.example.trim() : null,
            },
      );
    }
  }
  // Every input gets a row, so a skipped or malformed one shows as an error.
  return items.map((i) => byId.get(i.id) ?? { id: i.id, error: "No usable answer for this one" });
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
    const items = (Array.isArray(body?.ingredients) ? body.ingredients : []) as Input[];
    if (items.length === 0) {
      return new Response(JSON.stringify({ error: "ingredients is required" }), { status: 400 });
    }
    if (items.length > MAX_PER_CALL) {
      return new Response(JSON.stringify({ error: `At most ${MAX_PER_CALL} ingredients per call` }), { status: 400 });
    }
    const results = await estimate(items);
    return new Response(JSON.stringify({ results }), { headers: { "Content-Type": "application/json" } });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return new Response(JSON.stringify({ error: message }), { status: 422 });
  }
});
