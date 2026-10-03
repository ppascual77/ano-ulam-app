// Supermarket price lookup proxy — no DB access, same contract as
// ground-ingredients-usda: the client sends the ingredients it wants
// priced, this returns a candidate per ingredient with its source listing,
// and applying one is a separate, admin-confirmed client-side write (see
// docs/ingredient-data-architecture.md section 21: grounding never
// silently overwrites live data).
//
// No PH supermarket has a public price API, so the lookup is an LLM with
// OpenAI's web_search tool, asked for ONE real product listing (store,
// title, pack price, pack size, URL). The LLM is trusted only to READ a
// listing, never to do the math: converting "₱145 / 500g pack" into the
// ingredient's ₱/kg or ₱/L happens in normalizeToPriceUnit below, and the
// URL it reports must actually appear among the pages web_search returned
// (citations + consulted sources), so a made-up link can't slip through
// as a HIGH match.
//
// Cost (OpenAI pricing, Oct 2026): $10 / 1k web_search calls + a fixed
// ~8k-input-token block per call at the model's rate. Roughly 2-3¢ per
// ingredient. The client runs small chunks (see PriceGroundingPanel), never
// the whole table at once, so spend stays admin-controlled.

const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
const OPENAI_URL = "https://api.openai.com/v1/responses";
// Listed as web_search-capable in OpenAI's tools-web-search guide.
const MODEL = "gpt-4.1-mini";
// Each lookup is one web-searching request (~10-20s). Capped per call so a
// chunk finishes well inside the edge function's wall-clock limit.
const MAX_PER_CALL = 10;
const CONCURRENCY = 5;
// Outside this ₱/kg-or-L range a result is almost certainly a misread
// listing or a unit mixup, not a real price.
const MIN_PLAUSIBLE_PRICE = 5;
const MAX_PLAUSIBLE_PRICE = 50000;

// Official online stores of common PH supermarkets (domains confirmed
// 2026-10-03). web_search is restricted to these, so a price can't come
// from a marketplace seller, a delivery app's marked-up listing, a recipe
// blog, or an old news article. Landers and S&R are membership warehouse
// clubs, so the prompt still steers away from their bulk packs.
// Pandamart/GrabMart (marked-up) and Shopee/Lazada (inconsistent sellers)
// are left out on purpose.
const ALLOWED_STORES: { name: string; domain: string }[] = [
  { name: "SM Markets (SM Supermarket / Hypermarket / Savemore)", domain: "smmarkets.ph" },
  { name: "Puregold", domain: "puregold.com.ph" },
  { name: "GoRobinsons (Robinsons Supermarket / Shopwise / The Marketplace)", domain: "gorobinsons.ph" },
  { name: "WalterMart", domain: "waltermartdelivery.com.ph" },
  { name: "MetroMart", domain: "metromart.com" },
  { name: "Landers", domain: "landers.ph" },
  { name: "S&R", domain: "snrshopping.com" },
];

// Subdomains count (e.g. supermarket.gorobinsons.ph), anything else doesn't.
function isAllowedHost(host: string): boolean {
  return ALLOWED_STORES.some(({ domain }) => host === domain || host.endsWith(`.${domain}`));
}

type PriceInput = {
  id: string;
  canonicalName: string;
  displayName: string | null;
  basisUnit: string;
  state: string | null;
  gramsPerMl: number | null;
  gramsPerPiece: number | null;
};

type PackUnit = "g" | "kg" | "ml" | "L" | "piece";

type Listing = {
  found: boolean;
  store?: string;
  productTitle?: string;
  packPrice?: number;
  packSize?: number;
  packUnit?: PackUnit;
  url?: string;
  matchQuality?: "exact" | "close";
  note?: string;
};

type Candidate = {
  pricePerUnit: number;
  unit: "kg" | "L";
  store: string;
  productTitle: string;
  packPrice: number;
  packSize: number;
  packUnit: PackUnit;
  url: string;
};

type PriceResult =
  | { id: string; confidence: "NONE"; reason: string }
  | { id: string; confidence: "ERROR"; error: string }
  | { id: string; confidence: "HIGH" | "LOW"; candidate: Candidate; reasons: string[] };

const INSTRUCTIONS = `You look up current retail prices of grocery ingredients in Philippine supermarkets. Always search the web.

Find ONE online product listing with a visible price from one of these Philippine supermarkets' online stores, and only these: ${ALLOWED_STORES.map((s) => `${s.name} (${s.domain})`).join(", ")}. Pick the listing a Filipino home cook would normally buy for this ingredient: same cut/part, same state (raw vs cooked/dried/canned), plain and unflavored, a common or store brand, regular retail size (not bulk/wholesale). Prices are in PHP.

Return ONLY a JSON object, no markdown fences:
{"found": true, "store": string, "productTitle": string (as listed), "packPrice": number (PHP for the whole pack as listed; the current price if a sale price is shown), "packSize": number, "packUnit": "g" | "kg" | "ml" | "L" | "piece", "url": string (the product page the price came from), "matchQuality": "exact" | "close", "note": string}

- packSize + packUnit is the quantity the packPrice buys: 500 + "g", 1 + "L", 12 + "piece" for a dozen eggs. Meat/fish/produce priced per kilo: packPrice is the per-kg price, packSize 1, packUnit "kg".
- "exact": the same ingredient as named. "close": a reasonable stand-in (different cut, a flavored or branded variant, a different state); explain in "note".
- If you cannot find a real listing with a visible price, return {"found": false, "note": string}. Never estimate, average, or invent a price, size, or URL.`;

function describe(item: PriceInput): string {
  const parts = [`Ingredient: ${item.canonicalName}`];
  if (item.displayName && item.displayName !== item.canonicalName) parts.push(`commonly called "${item.displayName}"`);
  if (item.state) parts.push(`state: ${item.state}`);
  return parts.join(", ");
}

// Host + path, lowercased, no query/fragment/trailing slash, so the same
// page cited two slightly different ways still compares equal.
function normalizeUrl(raw: string): string | null {
  try {
    const u = new URL(raw);
    return `${u.hostname.replace(/^www\./, "")}${u.pathname.replace(/\/+$/, "")}`.toLowerCase();
  } catch {
    return null;
  }
}

function hostOf(raw: string): string | null {
  try {
    return new URL(raw).hostname.replace(/^www\./, "").toLowerCase();
  } catch {
    return null;
  }
}

// Pulls the model's final text plus every URL web_search actually surfaced:
// inline url_citation annotations and (via `include`) the full consulted
// source list.
function readResponse(data: any): { text: string; urls: string[] } {
  let text = "";
  const urls: string[] = [];
  for (const item of data.output ?? []) {
    if (item.type === "web_search_call") {
      for (const source of item.action?.sources ?? []) {
        if (typeof source?.url === "string") urls.push(source.url);
      }
    }
    if (item.type === "message") {
      for (const part of item.content ?? []) {
        if (part.type !== "output_text") continue;
        text += part.text ?? "";
        for (const a of part.annotations ?? []) {
          if (a.type === "url_citation" && typeof a.url === "string") urls.push(a.url);
        }
      }
    }
  }
  return { text, urls };
}

function parseListing(text: string): Listing {
  // web_search can't be combined with JSON mode, so the object comes back
  // as plain text, sometimes fenced or with a sentence around it.
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start < 0 || end <= start) throw new Error("Model didn't return a JSON object");
  return JSON.parse(text.slice(start, end + 1)) as Listing;
}

// Converts a listing's pack into the ingredient's own price unit: "kg" for
// a g-basis ingredient, "L" for an ml-basis one, matching the domain rule
// in ingredients_price_unit_check / verify-meal-ingredients check 3. A pack
// in the other domain (or sold by piece) converts through the ingredient's
// existing grams_per_ml / grams_per_piece bridge.
function normalizeToPriceUnit(
  listing: Required<Pick<Listing, "packPrice" | "packSize" | "packUnit">>,
  item: PriceInput,
): { ok: true; pricePerUnit: number; unit: "kg" | "L"; viaBridge: string | null } | { ok: false; reason: string } {
  const target: "kg" | "L" | null = item.basisUnit === "g" ? "kg" : item.basisUnit === "ml" ? "L" : null;
  if (!target) return { ok: false, reason: `Unsupported basis unit "${item.basisUnit}"` };

  let grams: number | null = null;
  let ml: number | null = null;
  let viaBridge: string | null = null;
  switch (listing.packUnit) {
    case "g": grams = listing.packSize; break;
    case "kg": grams = listing.packSize * 1000; break;
    case "ml": ml = listing.packSize; break;
    case "L": ml = listing.packSize * 1000; break;
    case "piece":
      if (!item.gramsPerPiece) return { ok: false, reason: "Sold by piece, but this ingredient has no grams_per_piece to convert with" };
      grams = listing.packSize * item.gramsPerPiece;
      viaBridge = "grams_per_piece";
      break;
    default:
      return { ok: false, reason: `Unrecognized pack unit "${listing.packUnit}"` };
  }

  let amount: number;
  if (target === "kg") {
    if (grams === null) {
      if (!item.gramsPerMl) return { ok: false, reason: "Sold by volume, but this ingredient has no grams_per_ml to convert with" };
      grams = (ml as number) * item.gramsPerMl;
      viaBridge = viaBridge ?? "grams_per_ml";
    }
    amount = grams / 1000;
  } else {
    if (ml === null) {
      if (!item.gramsPerMl) return { ok: false, reason: "Sold by weight, but this ingredient has no grams_per_ml to convert with" };
      ml = (grams as number) / item.gramsPerMl;
      viaBridge = viaBridge ?? "grams_per_ml";
    }
    amount = ml / 1000;
  }

  if (!(amount > 0)) return { ok: false, reason: "Pack size works out to zero" };
  return { ok: true, pricePerUnit: Math.round((listing.packPrice / amount) * 100) / 100, unit: target, viaBridge };
}

async function lookupListing(item: PriceInput): Promise<{ listing: Listing; urls: string[] }> {
  const res = await fetch(OPENAI_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${OPENAI_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: MODEL,
      instructions: INSTRUCTIONS,
      input: describe(item),
      tools: [
        {
          type: "web_search",
          search_context_size: "low",
          filters: { allowed_domains: ALLOWED_STORES.map((s) => s.domain) },
          user_location: { type: "approximate", country: "PH", city: "Manila", timezone: "Asia/Manila" },
        },
      ],
      tool_choice: "required",
      include: ["web_search_call.action.sources"],
      temperature: 0.1,
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`OpenAI request failed: ${res.status} ${body}`);
  }

  const { text, urls } = readResponse(await res.json());
  if (!text) throw new Error("OpenAI returned no text");
  return { listing: parseListing(text), urls };
}

async function priceOne(item: PriceInput): Promise<PriceResult> {
  try {
    const { listing, urls } = await lookupListing(item);

    if (!listing.found) {
      return { id: item.id, confidence: "NONE", reason: listing.note || "No supermarket listing found" };
    }
    const { store, productTitle, packPrice, packSize, packUnit, url } = listing;
    if (!store || !productTitle || !url || typeof packPrice !== "number" || typeof packSize !== "number" || !packUnit) {
      return { id: item.id, confidence: "NONE", reason: "Listing came back incomplete (missing price, size, or link)" };
    }
    if (!(packPrice > 0) || !(packSize > 0)) {
      return { id: item.id, confidence: "NONE", reason: "Listing has a zero/negative price or size" };
    }

    // Exact page among what web_search returned = verified. Same site but
    // a different page = plausible but unverified (LOW). Neither = the link
    // was likely invented; drop it rather than store a fake source.
    const normalizedUrl = normalizeUrl(url);
    const seenPages = new Set(urls.map(normalizeUrl).filter(Boolean));
    const seenHosts = new Set(urls.map(hostOf).filter(Boolean));
    const pageVerified = normalizedUrl !== null && seenPages.has(normalizedUrl);
    const hostVerified = pageVerified || (hostOf(url) !== null && seenHosts.has(hostOf(url)));
    // Backstop for the allowed_domains filter: never accept a source from
    // outside the store list, even if the search somehow returned one.
    const listingHost = hostOf(url);
    if (!listingHost || !isAllowedHost(listingHost)) {
      return { id: item.id, confidence: "NONE", reason: `Source ${listingHost ?? url} isn't one of the allowed supermarket sites` };
    }
    if (!hostVerified) {
      return { id: item.id, confidence: "NONE", reason: "Price link didn't match any page the search actually returned" };
    }

    const normalized = normalizeToPriceUnit({ packPrice, packSize, packUnit }, item);
    if (!normalized.ok) {
      return { id: item.id, confidence: "NONE", reason: normalized.reason };
    }
    if (normalized.pricePerUnit < MIN_PLAUSIBLE_PRICE || normalized.pricePerUnit > MAX_PLAUSIBLE_PRICE) {
      return {
        id: item.id,
        confidence: "NONE",
        reason: `Works out to ₱${normalized.pricePerUnit}/${normalized.unit}, outside a plausible range`,
      };
    }

    const reasons: string[] = [];
    if (!pageVerified) reasons.push("Exact page not confirmed by search, only the site");
    if (listing.matchQuality !== "exact") reasons.push(`Close match: ${listing.note || "not the exact ingredient"}`);
    if (normalized.viaBridge) reasons.push(`Converted via ${normalized.viaBridge}`);

    return {
      id: item.id,
      confidence: reasons.length === 0 ? "HIGH" : "LOW",
      reasons,
      candidate: {
        pricePerUnit: normalized.pricePerUnit,
        unit: normalized.unit,
        store,
        productTitle,
        packPrice,
        packSize,
        packUnit,
        url,
      },
    };
  } catch (err) {
    return { id: item.id, confidence: "ERROR", error: err instanceof Error ? err.message : String(err) };
  }
}

// Keeps at most `limit` lookups in flight; results stay in input order.
async function mapWithConcurrency<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const results = new Array<R>(items.length);
  let next = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) {
      const i = next++;
      results[i] = await fn(items[i]);
    }
  });
  await Promise.all(workers);
  return results;
}

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "POST only" }), { status: 405 });
  }
  if (!OPENAI_API_KEY) {
    return new Response(JSON.stringify({ error: "OPENAI_API_KEY not configured" }), { status: 500 });
  }

  const body = await req.json();
  const ingredients = body?.ingredients as PriceInput[] | undefined;
  if (!Array.isArray(ingredients)) {
    return new Response(JSON.stringify({ error: "ingredients must be an array" }), { status: 400 });
  }
  if (ingredients.length > MAX_PER_CALL) {
    return new Response(JSON.stringify({ error: `At most ${MAX_PER_CALL} ingredients per call` }), { status: 400 });
  }

  const results = await mapWithConcurrency(ingredients, CONCURRENCY, priceOne);

  return new Response(JSON.stringify({ results }), {
    headers: { "Content-Type": "application/json" },
  });
});
