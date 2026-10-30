// Seed Meal's optional AI bridge check (see the Seed Meal checks note in
// api/meals.ts). Everything arithmetic (missing prices, a price that can't
// convert, per-g prices that are really per-kg, missing macros) is checked
// in code on the client, not here. This judges only what code can't: does
// each ingredient's counted quantity, piece weight and density match the
// recipe's own text?
//
// Out of scope on purpose:
// - Macros: USDA/FNRI values are reference data; estimated ones get
//   re-grounded in Manage Ingredients, never re-guessed by an LLM.
// - Prices: they come from Price grounding (real listings / DA).
// - Re-linking to a different ingredient: that stays the admin's call.
//
// Before 2026-10-14 this got every field and a 9-point checklist, and it
// nearly always "found" something. Now it's told an empty answer is the
// normal one, and only sees the bridge fields.
//
// Since 2026-10-30 bridges can be verified (locked). It judged the shared
// piece weight against one recipe's "large onion", so each new meal
// "corrected" the last one's value. Now a piece weight means a typical
// piece, recipe-size differences are quantity fixes, and verified bridges
// are never flagged (the client drops those issues too).
//
// Writes nothing. The admin accepts or skips each issue in MealVerifyPanel.

const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
const OPENAI_URL = "https://api.openai.com/v1/chat/completions";
const MAX_ISSUES = 5;

type BridgeInput = {
  key: string;
  name: string;
  displayText: string;
  quantityAmount: number;
  quantityUnit: string;
  usedAmount: number;
  usedUnit: "g" | "ml";
  gramsPerPiece: number | null;
  pieceLabel: string | null;
  gramsPerMl: number | null;
  // The admin verified these (ingredient bridge locks): facts, not guesses.
  pieceVerified?: boolean;
  densityVerified?: boolean;
};

type BridgeField = "grams_per_piece" | "grams_per_ml" | "piece_label" | "quantity";

type BridgeIssue = {
  key: string;
  ingredientName: string;
  field: BridgeField;
  issue: string;
  currentValue: string;
  suggestedValue: string;
};

const FIELDS = new Set<BridgeField>(["grams_per_piece", "grams_per_ml", "piece_label", "quantity"]);

const SYSTEM_PROMPT = `You check one thing in a Filipino home-cooking recipe: whether each ingredient's COUNTED amount matches what the recipe text says.

Each ingredient gives you:
- displayText: the recipe's own words, e.g. "2 cups rice", "1 medium onion", "1 can (400 ml) coconut milk", "3 cloves garlic".
- quantityAmount + quantityUnit: what the admin entered (units: g, kg, ml, L, piece).
- usedAmount + usedUnit: what that became for the math, in grams or ml.
- gramsPerPiece + pieceLabel: weight of ONE piece, used when quantityUnit is "piece".
- gramsPerMl: density, used to turn ml into grams or back.
- pieceVerified / densityVerified: true when the admin already checked that bridge.

gramsPerPiece, pieceLabel and gramsPerMl belong to the INGREDIENT and are shared by every meal that uses it. gramsPerPiece always means one TYPICAL piece (a medium onion, one clove). So when this recipe's piece is bigger or smaller than typical ("1 large onion", "2 small tomatoes"), the bridge is not wrong: flag "quantity" for this recipe instead (e.g. "1 large onion" entered as 1 piece of a 110 g onion → suggest "160 g").

Flag an ingredient ONLY when usedAmount is clearly wrong for displayText, off by roughly 30% or more, and you can say exactly which value causes it:
- "quantity": the entered amount/unit doesn't match the text (e.g. "2 cups rice" entered as 2 g; "1 can" entered as 1 kg; "1 large onion" counted as a typical one). suggestedValue is "<number> <unit>" with unit one of g, kg, ml, L, piece, e.g. "370 g" or "2 piece".
- "grams_per_piece": the typical piece weight itself is unrealistic for this food, regardless of this recipe (a garlic clove is about 5 g, a medium onion about 110 g, an egg about 55 g). suggestedValue is a plain number of grams. Never when pieceVerified is true.
- "grams_per_ml": the density is unrealistic (water 1, cooking oil about 0.92, honey about 1.42). suggestedValue is a plain number. Never when densityVerified is true.
- "piece_label": only if it's wrong for this food (e.g. "clove" on an onion). Never when pieceVerified is true. suggestedValue is a short lowercase noun.

Rules:
- Most recipes have NO issues. An empty list is the normal, expected answer. Do not flag ordinary variation (a "medium onion" of 100 g vs 120 g is fine).
- A verified bridge is a fact. If the counted amount looks wrong for an ingredient with a verified bridge, the fix is always "quantity".
- Never comment on calories, macros, prices, or which ingredient was linked.
- At most ${MAX_ISSUES} issues, the clearest ones first.
- "issue" is one plain sentence a cook would understand, naming the recipe text and the resulting amount. "currentValue" is the current value of that field.

Return ONLY JSON: {"issues": [{"key": string, "ingredientName": string, "field": "quantity" | "grams_per_piece" | "grams_per_ml" | "piece_label", "issue": string, "currentValue": string, "suggestedValue": string}]}`;

async function checkBridges(meal: unknown, ingredients: BridgeInput[]): Promise<BridgeIssue[]> {
  const res = await fetch(OPENAI_URL, {
    method: "POST",
    headers: { Authorization: `Bearer ${OPENAI_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      response_format: { type: "json_object" },
      temperature: 0,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: JSON.stringify({ meal, ingredients }) },
      ],
    }),
  });
  if (!res.ok) throw new Error(`OpenAI request failed: ${res.status} ${await res.text()}`);

  const data = await res.json();
  const raw = data.choices?.[0]?.message?.content;
  if (!raw) throw new Error("OpenAI returned no content");
  const parsed = JSON.parse(raw);
  const byKey = new Map(ingredients.map((i) => [i.key, i]));
  // Verified bridges are facts; drop anything aimed at one before the cap,
  // so it can't crowd out a real quantity issue.
  const locked = (i: { key: string; field: BridgeField }) => {
    const ing = byKey.get(i.key);
    if (!ing) return true;
    if (i.field === "grams_per_ml") return !!ing.densityVerified;
    return (i.field === "grams_per_piece" || i.field === "piece_label") && !!ing.pieceVerified;
  };
  const issues: BridgeIssue[] = [];
  for (const i of Array.isArray(parsed.issues) ? parsed.issues : []) {
    if (
      i && byKey.has(i.key) && FIELDS.has(i.field) && !locked(i) &&
      typeof i.issue === "string" && typeof i.suggestedValue === "string" && i.suggestedValue.trim() !== ""
    ) {
      issues.push({
        key: i.key,
        ingredientName: typeof i.ingredientName === "string" ? i.ingredientName : "",
        field: i.field,
        issue: i.issue,
        currentValue: typeof i.currentValue === "string" ? i.currentValue : String(i.currentValue ?? ""),
        suggestedValue: i.suggestedValue.trim(),
      });
    }
  }
  return issues.slice(0, MAX_ISSUES);
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
    const ingredients = body?.ingredients as BridgeInput[] | undefined;
    if (!Array.isArray(ingredients) || ingredients.length === 0) {
      return new Response(JSON.stringify({ error: "ingredients are required" }), { status: 400 });
    }
    const issues = await checkBridges(body?.meal ?? null, ingredients);
    return new Response(JSON.stringify({ issues }), { headers: { "Content-Type": "application/json" } });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return new Response(JSON.stringify({ error: message }), { status: 422 });
  }
});
