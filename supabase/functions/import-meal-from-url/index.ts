// Scrapes a recipe URL and uses an LLM to rewrite it into this project's
// meal shape. Two extraction tiers (the reference implementation this was
// modeled on has a third — WordPress recipe-plugin DOM selectors — skipped
// here since it needs real HTML/DOM parsing Deno doesn't have built in, and
// JSON-LD already covers the large majority of modern recipe sites):
//   1. JSON-LD `Recipe` schema.org node — preferred, structured, reliable.
//   2. Fallback: strip tags, hand the LLM raw page text and let it figure
//      out the recipe from unstructured content.
//
// Does NOT write to the database — same "grounding never silently applies"
// principle as ground-ingredients-usda. Returns a draft the admin reviews
// and edits in SeedMealScreen before anything is saved.
//
// Ingredient quantities are returned as free-text (`quantity_text`, e.g.
// "2 cloves", "1/4 cup", "to taste") rather than forced into this project's
// numeric amount + g/kg/ml/L/piece unit enum — recipe language uses units
// (cups, tablespoons) this schema doesn't model, and getting that
// conversion wrong silently would be worse than asking the admin to set
// the real amount/unit while binding each ingredient in SyncIngredientsPanel.
//
// Also deliberately does NOT divide quantities by serving count (unlike
// the reference implementation, which always normalizes to 1 serving).
// Guessing a batch size from ingredient quantities when a recipe doesn't
// state its yield is exactly the kind of invented-precision this project
// has avoided everywhere else (see docs/ingredient-data-architecture.md).
// Instead, `servings` is returned as its own field and stored as the
// meal's serving_size — the ingredient list represents the recipe AS
// EXTRACTED, for that many servings, not silently rescaled to 1.

const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
const OPENAI_URL = "https://api.openai.com/v1/chat/completions";
const MAX_HTML_BYTES = 5 * 1024 * 1024;
const FETCH_TIMEOUT_MS = 10_000;
const MAX_RAW_TEXT_CHARS = 6000;

type RecipeExtraction =
  | { tier: "json-ld"; name?: string; description?: string; ingredients: string[]; instructions: string[]; yield?: string; image: string | null }
  | { tier: "raw-text"; text: string };

// schema.org's Recipe `image` can be a bare URL string, an array of URL
// strings, an ImageObject ({ url }), or an array of ImageObjects — this
// normalizes any of those shapes down to a single best-guess URL (the
// first one found), or null if the recipe simply didn't declare one.
function extractImageUrl(value: unknown): string | null {
  if (typeof value === "string") return value;
  if (Array.isArray(value)) {
    for (const item of value) {
      const found = extractImageUrl(item);
      if (found) return found;
    }
    return null;
  }
  if (value && typeof value === "object") {
    const url = (value as Record<string, unknown>).url;
    if (typeof url === "string") return url;
  }
  return null;
}

function isDisallowedUrl(url: URL): boolean {
  if (url.protocol !== "http:" && url.protocol !== "https:") return true;
  const host = url.hostname.toLowerCase();
  if (host === "localhost" || host === "127.0.0.1" || host === "::1") return true;
  // Private IPv4 ranges — best-effort check, not exhaustive.
  if (/^10\.|^192\.168\.|^172\.(1[6-9]|2\d|3[01])\./.test(host)) return true;
  return false;
}

async function fetchHtml(url: string): Promise<string> {
  const parsed = new URL(url);
  if (isDisallowedUrl(parsed)) {
    throw new Error("URL not allowed (must be a public http/https URL)");
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(parsed.toString(), {
      signal: controller.signal,
      headers: { "User-Agent": "AnoUlamRecipeImporter/1.0" },
    });
    if (!res.ok) throw new Error(`Failed to fetch URL: ${res.status} ${res.statusText}`);
    const contentType = res.headers.get("content-type") ?? "";
    if (!contentType.includes("text/html")) {
      throw new Error(`URL did not return HTML (content-type: ${contentType})`);
    }
    const buf = await res.arrayBuffer();
    if (buf.byteLength > MAX_HTML_BYTES) throw new Error("Page too large to import");
    return new TextDecoder("utf-8").decode(buf);
  } finally {
    clearTimeout(timeout);
  }
}

// Flattens schema.org's various recipeInstructions shapes (plain strings,
// HowToStep objects, or HowToSection groups containing itemListElement)
// into a flat ordered list of step text.
function flattenInstructions(value: unknown): string[] {
  if (!value) return [];
  if (typeof value === "string") return [value];
  if (Array.isArray(value)) return value.flatMap(flattenInstructions);
  if (typeof value === "object") {
    const obj = value as Record<string, unknown>;
    if (typeof obj.text === "string") return [obj.text];
    if (obj.itemListElement) return flattenInstructions(obj.itemListElement);
    if (typeof obj.name === "string") return [obj.name];
  }
  return [];
}

function findRecipeNode(node: unknown): Record<string, unknown> | null {
  if (!node || typeof node !== "object") return null;
  if (Array.isArray(node)) {
    for (const item of node) {
      const found = findRecipeNode(item);
      if (found) return found;
    }
    return null;
  }
  const obj = node as Record<string, unknown>;
  const type = obj["@type"];
  const types = Array.isArray(type) ? type : [type];
  if (types.some((t) => typeof t === "string" && t.toLowerCase() === "recipe")) {
    return obj;
  }
  if (obj["@graph"]) return findRecipeNode(obj["@graph"]);
  return null;
}

function extractJsonLdRecipe(html: string): RecipeExtraction | null {
  const scriptRegex = /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let match: RegExpExecArray | null;
  while ((match = scriptRegex.exec(html)) !== null) {
    try {
      const json = JSON.parse(match[1].trim());
      const recipe = findRecipeNode(json);
      if (!recipe) continue;
      const ingredients = Array.isArray(recipe.recipeIngredient)
        ? (recipe.recipeIngredient as unknown[]).filter((i): i is string => typeof i === "string")
        : [];
      const instructions = flattenInstructions(recipe.recipeInstructions);
      if (ingredients.length === 0 && instructions.length === 0) continue;
      return {
        tier: "json-ld",
        name: typeof recipe.name === "string" ? recipe.name : undefined,
        description: typeof recipe.description === "string" ? recipe.description : undefined,
        ingredients,
        instructions,
        yield: typeof recipe.recipeYield === "string" ? recipe.recipeYield : undefined,
        image: extractImageUrl(recipe.image),
      };
    } catch {
      continue;
    }
  }
  return null;
}

function extractRawText(html: string): RecipeExtraction {
  const stripped = html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<nav[\s\S]*?<\/nav>/gi, " ")
    .replace(/<header[\s\S]*?<\/header>/gi, " ")
    .replace(/<footer[\s\S]*?<\/footer>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return { tier: "raw-text", text: stripped.slice(0, MAX_RAW_TEXT_CHARS) };
}

type MealDraft = {
  name: string;
  description: string;
  category: "luto";
  prep_time: number | null;
  total_time: number | null;
  difficulty: "easy" | "medium" | "hard" | null;
  protein_type: string | null;
  servings: number;
  procedure: string[];
  allergens: string[];
  dietary_tags: string[];
  tags: string[];
  ingredients: { name: string; quantity_text: string }[];
  // The source page's own recipe photo, taken straight from JSON-LD (never
  // LLM-generated — set programmatically below, not part of the prompt's
  // output shape). Reference-only for AI meal-photo generation later; never
  // displayed to consumers as this meal's actual photo.
  reference_image_url: string | null;
};

const SYSTEM_PROMPT = `You rewrite scraped recipe content into a structured JSON meal record for a Filipino home-cooking app called AnoUlam.

LEGAL/REWRITE RULES (important — this is what makes the output usable, not a copyright problem):
- Substantially rewrite the description and every procedure step in your own words. No run of more than 5 consecutive words may be copied verbatim from the source. Do not preserve the source's exact sentence/clause ordering.
- Never mention the source, the original site, or attribute the recipe to anyone.
- Despite the rewrite requirement, you MUST preserve every fact: every ingredient the source lists must still appear in your ingredients array, and every distinct sub-step in the source must still get its own procedure step. Dropping an ingredient or merging two distinct steps into one is a data-loss bug, not a valid rewrite.
- Ingredient names and quantities are facts, not expression — copy those faithfully (just normalize phrasing/casing), do not paraphrase amounts.

DIETARY_TAGS — derive these by actually checking the full ingredients list, don't default to empty:
1. Scan every ingredient for meat, poultry, fish, shellfish/seafood, gelatin, and animal-derived stock/sauce (fish sauce, oyster sauce, lard).
2. Scan for dairy (milk, cheese, butter, cream) and eggs.
3. Apply ALL that hold: no meat/poultry/fish/shellfish/gelatin/animal stock found -> include "vegetarian". Also no dairy/eggs found (nothing animal-derived at all) -> additionally include "vegan". Fish/shellfish present but no meat/poultry -> "pescatarian" instead of "vegetarian"/"vegan". A dish that is genuinely just vegetables/fruit/grains/legumes/oil/vinegar/seasonings — no meat, dairy, or eggs anywhere — MUST get both "vegetarian" and "vegan", never [].
4. Only return [] when the recipe clearly contains meat/poultry/fish and no other tag applies.

ALLERGENS — scan every ingredient and include ALL that apply, using exactly these values: "nuts", "gluten", "dairy", "egg", "shellfish", "fish", "soy", "coconut", "sesame". [] only if truly none of these appear.

TAGS — a single flat array combining two independent signals, using exactly these ids (this app's UI renders/filters by these exact strings, do not invent your own):
1. Nutrition/style — pick AT MOST ONE from each of these two groups, and only when the recipe clearly leans that way (a rough miss here is fine — the real value gets recalculated precisely from actual computed macros later, so don't force a guess for an ordinary dish that doesn't stand out):
   - Macro character: "highProtein" (a substantial meat/fish/egg/legume-based main), "lowCarb", "highCarb" (rice/noodle/bread-heavy), "highFat", "lowFat", "highCalorie", "lowCalorie".
   - Overall character: "energyMeal", "filling", "balanced", "quick" — "quick" is NOT a guess: include it whenever total_time is 20 minutes or less, omit it otherwise.
2. Way of cooking — include ALL that clearly apply based on the actual procedure (this one IS observable from the text, be thorough): "soupy" (broth/soup-based), "grilled", "fried".
Example: ["highProtein", "quick", "grilled"]. [] only if genuinely nothing applies.

OUTPUT SHAPE — return ONLY a JSON object (no markdown fences) matching exactly:
{
  "name": string,
  "description": string,
  "category": "luto",
  "prep_time": number | null,       // minutes
  "total_time": number | null,      // minutes
  "difficulty": "easy" | "medium" | "hard" | null,
  "protein_type": string | null,    // e.g. "chicken", "pork", "seafood", "vegetarian"
  "servings": number,               // the recipe's actual stated or clearly implied yield; default 4 if truly unknown
  "procedure": string[],            // one array element per distinct step
  "allergens": string[],            // apply the ALLERGENS rules above
  "dietary_tags": string[],         // apply the DIETARY_TAGS rules above — e.g. ["vegetarian", "vegan"], ["pescatarian"], [] only if meat/poultry/fish present
  "tags": string[],                 // apply the TAGS rules above — e.g. ["highProtein", "quick", "grilled"]
  "ingredients": [ { "name": string, "quantity_text": string } ]  // quantity_text is a short human string like "500 grams", "3 cloves", "to taste" — do not convert units
}

If the source content isn't actually a recipe, or you cannot identify real ingredients/steps, return {"error": "reason"} instead.`;

async function rewriteWithOpenAI(extraction: RecipeExtraction): Promise<MealDraft> {
  if (!OPENAI_API_KEY) throw new Error("OPENAI_API_KEY not configured");

  const userContent =
    extraction.tier === "json-ld"
      ? JSON.stringify(
          {
            name: extraction.name,
            description: extraction.description,
            ingredients: extraction.ingredients,
            instructions: extraction.instructions,
            yield: extraction.yield,
          },
          null,
          2,
        )
      : `Unstructured page text (find the recipe within it):\n\n${extraction.text}`;

  const res = await fetch(OPENAI_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${OPENAI_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      response_format: { type: "json_object" },
      temperature: 0.4,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: userContent },
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
  if (parsed.error) throw new Error(`Could not extract a recipe: ${parsed.error}`);
  return parsed as MealDraft;
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
    const url = body?.url as string | undefined;
    if (!url) {
      return new Response(JSON.stringify({ error: "url is required" }), { status: 400 });
    }

    const html = await fetchHtml(url);
    const extraction = extractJsonLdRecipe(html) ?? extractRawText(html);
    const meal = await rewriteWithOpenAI(extraction);
    // Taken straight from the page's own structured data, not the LLM — it
    // has no way to know the real photo URL and shouldn't be asked to guess.
    meal.reference_image_url = extraction.tier === "json-ld" ? extraction.image : null;

    return new Response(JSON.stringify({ meal, extraction_tier: extraction.tier }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return new Response(JSON.stringify({ error: message }), { status: 422 });
  }
});
