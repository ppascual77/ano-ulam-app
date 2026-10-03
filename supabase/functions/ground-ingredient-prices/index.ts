// Supermarket price lookup proxy — no DB access, same contract as
// ground-ingredients-usda: the client sends the ingredients it wants
// priced, this returns up to MAX_SOURCES candidates per ingredient (one per
// store) with their source listings,
// and applying one is a separate, admin-confirmed client-side write (see
// docs/ingredient-data-architecture.md section 21: grounding never
// silently overwrites live data).
//
// No PH supermarket has a public price API, so the lookup is an LLM with
// OpenAI's web_search tool, asked for real product listings (store, title,
// pack price, pack size, URL), one per store. The LLM is trusted only to READ a
// listing, never to do the math: converting "₱145 / 500g pack" into the
// ingredient's ₱/kg or ₱/L happens in normalizeToPriceUnit below, and the
// URL it reports must actually appear among the pages web_search returned
// (citations + consulted sources), so a made-up link can't slip through
// as a HIGH match.
//
// Cost (OpenAI pricing, Oct 2026): $10 / 1k web_search calls + search
// content tokens at gpt-5-mini's rate ($0.25 / 1M input). Roughly 2-4¢
// per ingredient; check the usage dashboard after the first run. The client runs small chunks (see PriceGroundingPanel), never
// the whole table at once, so spend stays admin-controlled.

const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
const OPENAI_URL = "https://api.openai.com/v1/responses";
// A reasoning model: gpt-4.1-mini supports web_search but rejected the
// `filters` (allowed_domains) parameter with a 400.
const MODEL = "gpt-5-mini";
// Each lookup is one web-searching request (~10-30s with a reasoning
// model). Kept small so a call (plus rate-limit retries) finishes well
// inside the edge function's wall-clock limit. CONCURRENCY was 5, which
// with the client running chunks in parallel hit gpt-5-mini's per-minute
// rate limit; the client now runs chunks one at a time.
const MAX_PER_CALL = 5;
const CONCURRENCY = 3;
// 429 retries: OpenAI's message usually says "try again in 1.2s"; when it
// doesn't, back off 2s → 4s → 8s. Each wait capped so retries can't eat
// the whole wall-clock budget.
const MAX_RATE_LIMIT_RETRIES = 3;
const MAX_RETRY_WAIT_MS = 20000;
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

// Up to this many listings per ingredient, each from a different store, so
// the admin can average several real prices instead of trusting one. All
// come from the SAME web-searching request, so this doesn't multiply cost
// the way 3 separate lookups would.
const MAX_SOURCES = 3;

type Listing = {
  store?: string;
  productTitle?: string;
  packPrice?: number;
  packSize?: number;
  packUnit?: PackUnit;
  url?: string;
  matchQuality?: "exact" | "close";
  note?: string;
};

type ModelResponse = { listings?: Listing[]; note?: string };

type Candidate = {
  confidence: "HIGH" | "LOW";
  reasons: string[];
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
  // `confidence` is the best candidate's, so the row-level tier still reads
  // the same as before; each candidate carries its own tier and reasons.
  | { id: string; confidence: "HIGH" | "LOW"; candidates: Candidate[] };

const INSTRUCTIONS = `You look up current retail prices of grocery ingredients in Philippine supermarkets. Always search the web.

Find up to ${MAX_SOURCES} online product listings with a visible price, EACH FROM A DIFFERENT STORE, from these Philippine supermarkets' online stores, and only these: ${ALLOWED_STORES.map((s) => `${s.name} (${s.domain})`).join(", ")}. For each store, pick the listing a Filipino home cook would normally buy for this ingredient: same cut/part, same state (raw vs cooked/dried/canned), plain and unflavored, a common or store brand, regular retail size (not bulk/wholesale). Prices are in PHP.

Return ONLY a JSON object, no markdown fences:
{"listings": [{"store": string, "productTitle": string (as listed), "packPrice": number (PHP for the whole pack as listed; the current price if a sale price is shown), "packSize": number, "packUnit": "g" | "kg" | "ml" | "L" | "piece", "url": string (the product page the price came from), "matchQuality": "exact" | "close", "note": string}], "note": string}

- packSize + packUnit is the quantity the packPrice buys: 500 + "g", 1 + "L", 12 + "piece" for a dozen eggs. Meat/fish/produce priced per kilo: packPrice is the per-kg price, packSize 1, packUnit "kg".
- "exact": the same ingredient as named. "close": a reasonable stand-in (different cut, a flavored or branded variant, a different state); explain in "note".
- Fewer than ${MAX_SOURCES} is fine; never pad with a second listing from the same store or a weak match just to fill the list.
- If you cannot find any real listing with a visible price, return {"listings": [], "note": string explaining why}. Never estimate, average, or invent a price, size, or URL.`;

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

function parseModelResponse(text: string): ModelResponse {
  // web_search can't be combined with JSON mode, so the object comes back
  // as plain text, sometimes fenced or with a sentence around it.
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start < 0 || end <= start) throw new Error("Model didn't return a JSON object");
  const parsed = JSON.parse(text.slice(start, end + 1));
  return { listings: Array.isArray(parsed.listings) ? parsed.listings : [], note: parsed.note };
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

// Flipped off for the rest of this worker's life if OpenAI rejects the
// domain filter for MODEL (gpt-4.1-mini did, with a 400). Without it the
// prompt still names the stores and priceOne's isAllowedHost check still
// rejects any other source, so results just come back NONE more often
// instead of the whole run erroring.
let domainFilterSupported = true;

function retryDelayMs(body: string, attempt: number): number {
  const match = body.match(/try again in (\d+(?:\.\d+)?)\s*(ms|s)\b/i);
  const hinted = match ? Number(match[1]) * (match[2].toLowerCase() === "s" ? 1000 : 1) : null;
  // Small buffer + jitter so parallel lookups don't all retry in lockstep.
  const base = hinted != null ? hinted + 250 : 2000 * 2 ** attempt;
  return Math.min(base + Math.random() * 500, MAX_RETRY_WAIT_MS);
}

async function requestOpenAI(item: PriceInput, withDomainFilter: boolean): Promise<Response> {
  for (let attempt = 0; ; attempt++) {
    const res = await sendOpenAIRequest(item, withDomainFilter);
    if (res.status !== 429 || attempt >= MAX_RATE_LIMIT_RETRIES) return res;
    const body = await res.clone().text();
    // Out of credits is also a 429, but waiting won't fix it.
    if (/insufficient_quota/i.test(body)) return res;
    await new Promise((resolve) => setTimeout(resolve, retryDelayMs(body, attempt)));
  }
}

function sendOpenAIRequest(item: PriceInput, withDomainFilter: boolean) {
  return fetch(OPENAI_URL, {
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
          ...(withDomainFilter ? { filters: { allowed_domains: ALLOWED_STORES.map((s) => s.domain) } } : {}),
          user_location: { type: "approximate", country: "PH", city: "Manila", timezone: "Asia/Manila" },
        },
      ],
      tool_choice: "required",
      include: ["web_search_call.action.sources"],
      // Reasoning models reject `temperature`; web_search doesn't work
      // with "minimal" effort, so "low" is the cheapest that does.
      reasoning: { effort: "low" },
    }),
  });
}

async function lookupListings(item: PriceInput): Promise<{ response: ModelResponse; urls: string[] }> {
  let res = await requestOpenAI(item, domainFilterSupported);

  if (!res.ok && res.status === 400 && domainFilterSupported) {
    const body = await res.text();
    if (!/filters/i.test(body)) throw new Error(`OpenAI request failed: ${res.status} ${body}`);
    domainFilterSupported = false;
    console.warn(`[ground-ingredient-prices] ${MODEL} rejected the domain filter, retrying without it: ${body}`);
    res = await requestOpenAI(item, false);
  }

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`OpenAI request failed: ${res.status} ${body}`);
  }

  const { text, urls } = readResponse(await res.json());
  if (!text) throw new Error("OpenAI returned no text");
  return { response: parseModelResponse(text), urls };
}

// Checks one listing the same way a single result used to be checked:
// complete, from an allowed store, a page the search actually returned,
// convertible to the ingredient's unit, and in a plausible range. Returns a
// candidate, or why it was dropped.
function checkListing(
  listing: Listing,
  item: PriceInput,
  seenPages: Set<string>,
  seenHosts: Set<string>,
): { ok: true; candidate: Candidate } | { ok: false; reason: string } {
  const { store, productTitle, packPrice, packSize, packUnit, url } = listing;
  const label = store || "A listing";
  if (!store || !productTitle || !url || typeof packPrice !== "number" || typeof packSize !== "number" || !packUnit) {
    return { ok: false, reason: `${label} came back incomplete (missing price, size, or link)` };
  }
  if (!(packPrice > 0) || !(packSize > 0)) {
    return { ok: false, reason: `${label} has a zero/negative price or size` };
  }

  // Backstop for the allowed_domains filter: never accept a source from
  // outside the store list, even if the search somehow returned one.
  const listingHost = hostOf(url);
  if (!listingHost || !isAllowedHost(listingHost)) {
    return { ok: false, reason: `${listingHost ?? url} isn't one of the allowed supermarket sites` };
  }
  // Exact page among what web_search returned = verified. Same site but a
  // different page = plausible but unverified (LOW). Neither = the link was
  // likely invented; drop it rather than store a fake source.
  const normalizedUrl = normalizeUrl(url);
  const pageVerified = normalizedUrl !== null && seenPages.has(normalizedUrl);
  if (!pageVerified && !seenHosts.has(listingHost)) {
    return { ok: false, reason: `${label}'s link didn't match any page the search actually returned` };
  }

  const normalized = normalizeToPriceUnit({ packPrice, packSize, packUnit }, item);
  if (!normalized.ok) return { ok: false, reason: `${label}: ${normalized.reason}` };
  if (normalized.pricePerUnit < MIN_PLAUSIBLE_PRICE || normalized.pricePerUnit > MAX_PLAUSIBLE_PRICE) {
    return { ok: false, reason: `${label} works out to ₱${normalized.pricePerUnit}/${normalized.unit}, outside a plausible range` };
  }

  const reasons: string[] = [];
  if (!pageVerified) reasons.push("Exact page not confirmed by search, only the site");
  if (listing.matchQuality !== "exact") reasons.push(`Close match: ${listing.note || "not the exact ingredient"}`);
  if (normalized.viaBridge) reasons.push(`Converted via ${normalized.viaBridge}`);

  return {
    ok: true,
    candidate: {
      confidence: reasons.length === 0 ? "HIGH" : "LOW",
      reasons,
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
}

// Search indexes keep old snapshots: Puregold's product pages, for one,
// all 404 now even though web_search still returns them (with a price that
// may be stale). A source whose page is definitely gone is dropped. Only a
// 404/410 counts: a timeout, TLS error, or 403 bot-block says nothing about
// the page (gorobinsons.ph fails TLS from some clients but works in a
// browser), so those sources are kept.
const LINK_CHECK_TIMEOUT_MS = 6000;

async function isDeadLink(url: string): Promise<boolean> {
  try {
    const res = await fetch(url, {
      redirect: "follow",
      headers: { "User-Agent": "Mozilla/5.0 (compatible; AnoUlamPriceCheck/1.0)" },
      signal: AbortSignal.timeout(LINK_CHECK_TIMEOUT_MS),
    });
    await res.body?.cancel();
    return res.status === 404 || res.status === 410;
  } catch {
    return false;
  }
}

async function priceOne(item: PriceInput): Promise<PriceResult> {
  try {
    const { response, urls } = await lookupListings(item);
    const seenPages = new Set(urls.map(normalizeUrl).filter((u): u is string => !!u));
    const seenHosts = new Set(urls.map(hostOf).filter((h): h is string => !!h));

    const candidates: Candidate[] = [];
    const dropped: string[] = [];
    const usedHosts = new Set<string>();
    for (const listing of response.listings ?? []) {
      const checked = checkListing(listing, item, seenPages, seenHosts);
      if (!checked.ok) {
        dropped.push(checked.reason);
        continue;
      }
      // One per store, even if the model returned two from the same site:
      // averaging two SM listings would just double-weight SM.
      const host = hostOf(checked.candidate.url) as string;
      if (usedHosts.has(host)) continue;
      usedHosts.add(host);
      candidates.push(checked.candidate);
    }

    // Link check runs on every passing source (in parallel) before the cap,
    // so a dead Puregold page frees its slot for the next store.
    const dead = await Promise.all(candidates.map((c) => isDeadLink(c.url)));
    const live: Candidate[] = [];
    candidates.forEach((c, i) => {
      if (dead[i]) dropped.push(`${c.store}'s page no longer exists (404), so its price may be outdated`);
      else live.push(c);
    });
    candidates.length = 0;
    candidates.push(...live.slice(0, MAX_SOURCES));

    if (candidates.length === 0) {
      return {
        id: item.id,
        confidence: "NONE",
        reason: dropped[0] ?? response.note ?? "No supermarket listing found",
      };
    }
    // HIGH first, so the best source leads the list in the UI.
    candidates.sort((a, b) => (a.confidence === b.confidence ? 0 : a.confidence === "HIGH" ? -1 : 1));
    return { id: item.id, confidence: candidates[0].confidence, candidates };
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
