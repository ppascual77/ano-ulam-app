// DA Daily Price Index reader, no DB access (same contract as the
// grounding functions): it lists and parses DA's PDFs, and the admin's
// confirmed save is a separate client-side write (api/daPrices.ts). No
// secret is involved; this is an edge function because PDF parsing needs
// pdf.js, which is heavy and awkward to run on the device.
//
//   { action: "list" }              → the newest Daily Price Index PDFs on DA's page
//   { action: "list", html }        → same, from the page's HTML fetched by the
//                                     caller (the daily job: DA is often too slow
//                                     or blocking from here)
//   { action: "parse", pdfBase64 }  → { date, rows } for one PDF (see parse.ts)
//   { action: "parse", url }        → same, fetching the PDF here
//   { action: "ingest", pdfBase64, url }  → parse AND save (the daily
//       GitHub Actions job, .github/workflows/da-daily-prices.yml). Needs the
//       `x-cron-secret` header to match the DA_CRON_SECRET function secret;
//       saves with the service role, the same two upserts as the admin's
//       save (api/daPrices.ts saveDaDailyPrices). Saving a date again
//       overwrites it, so reruns are harmless.
//
// The app sends pdfBase64: DA's site throttles or blocks this server's IPs
// on PDF downloads (timeouts here while instant from a phone), so the app
// downloads the PDF itself. The url form is kept for testing.

import { getDocumentProxy } from "npm:unpdf@0.12.1";
import { createClient } from "npm:@supabase/supabase-js@2";
import { DA_UPLOADS_PREFIX, listDailyPdfs, parseDailyPriceIndex, type DaParseResult, type ListedPdf, type TextItem } from "./parse.ts";
import { requireAdmin } from "../_shared/requireAdmin.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const DA_CRON_SECRET = Deno.env.get("DA_CRON_SECRET");

const DA_PRICE_PAGE = "https://www.da.gov.ph/price-monitoring/";
const LIST_LIMIT = 14;
// DA's site rejects requests without a browser-like user agent.
const FETCH_HEADERS = { "User-Agent": "Mozilla/5.0 (AnoUlam admin)" };
// DA's site is slow (10-15s for the price page at times) and sometimes
// hangs. Without a limit a hung request runs until the function's own
// wall-clock limit, and the admin screen just spins.
const PAGE_TIMEOUT_MS = 25_000;
const PDF_TIMEOUT_MS = 45_000;

async function fetchDa(url: string, timeoutMs: number, what: string): Promise<Response> {
  let res: Response;
  try {
    res = await fetch(url, { headers: FETCH_HEADERS, signal: AbortSignal.timeout(timeoutMs) });
  } catch (err) {
    if (err instanceof DOMException && err.name === "TimeoutError") {
      throw new Error(`DA's site didn't answer within ${timeoutMs / 1000}s (${what}). It's often slow, try again in a minute.`);
    }
    throw new Error(`Couldn't reach DA's site (${what}): ${err instanceof Error ? err.message : String(err)}`);
  }
  if (!res.ok) throw new Error(`DA's site returned ${res.status} (${what})`);
  return res;
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

async function listPdfs(): Promise<ListedPdf[]> {
  const res = await fetchDa(DA_PRICE_PAGE, PAGE_TIMEOUT_MS, "price monitoring page");
  return listDailyPdfs(await res.text(), LIST_LIMIT);
}

async function fetchPdf(url: string): Promise<Uint8Array> {
  const res = await fetchDa(url, PDF_TIMEOUT_MS, "PDF");
  return new Uint8Array(await res.arrayBuffer());
}

function decodeBase64(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

async function parsePdf(bytes: Uint8Array) {
  const pdf = await getDocumentProxy(bytes);

  const pages: TextItem[][] = [];
  for (let n = 1; n <= pdf.numPages; n++) {
    const { items } = await (await pdf.getPage(n)).getTextContent();
    pages.push(
      items
        .filter((it) => "str" in it)
        .map((it) => ({ str: it.str, x: it.transform[4], y: it.transform[5], width: it.width })),
    );
  }
  return parseDailyPriceIndex(pages);
}

// Same as api/daPrices.ts saveDaDailyPrices (keep the two in step): the
// commodities first (new ones added), then that day's prices. The price
// triggers re-pick each linked ingredient's cheapest price from there.
async function savePrices(parsed: DaParseResult, sourceUrl: string) {
  const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
  const priced = parsed.rows.filter((r) => r.price != null);
  if (priced.length === 0) throw new Error(`No prices found in the PDF for ${parsed.date}`);
  const { data: commodities, error } = await admin
    .from("da_commodities")
    .upsert(
      priced.map((r) => ({
        commodity: r.commodity,
        specification: r.specification,
        section: r.section,
        unit: r.unit,
        unit_size: r.unitSize,
      })),
      { onConflict: "commodity,specification" },
    )
    .select("id, commodity, specification");
  if (error) throw new Error(`Saving commodities failed: ${error.message}`);
  const key = (c: { commodity: string; specification: string }) => `${c.commodity}|${c.specification}`;
  const idByKey = new Map(commodities.map((c) => [key(c), c.id]));
  const { error: priceError } = await admin.from("daily_prices").upsert(
    priced.map((r) => ({
      da_commodity_id: idByKey.get(key(r))!,
      price_date: parsed.date,
      price: r.price!,
      source_url: sourceUrl,
    })),
    { onConflict: "da_commodity_id,price_date" },
  );
  if (priceError) throw new Error(`Saving prices failed: ${priceError.message}`);
  return { date: parsed.date, saved: priced.length };
}

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") return json({ error: "POST only" }, 405);

  try {
    const body = await req.json();
    // "list" and "parse": the admin's DA Daily Prices screen, or the scheduled
    // job (which sends the cron secret on every call). "ingest" checks the
    // secret itself below.
    if (body?.action === "list" || body?.action === "parse") {
      const fromCron = !!DA_CRON_SECRET && req.headers.get("x-cron-secret") === DA_CRON_SECRET;
      if (!fromCron) {
        const denied = await requireAdmin(req);
        if (denied) return denied;
      }
    }
    if (body?.action === "list") {
      if (typeof body.html === "string" && body.html.length > 0) {
        return json({ pdfs: listDailyPdfs(body.html, LIST_LIMIT) });
      }
      return json({ pdfs: await listPdfs() });
    }
    if (body?.action === "parse") {
      if (typeof body.pdfBase64 === "string" && body.pdfBase64.length > 0) {
        return json(await parsePdf(decodeBase64(body.pdfBase64)));
      }
      const url = body.url;
      if (typeof url !== "string" || !url.startsWith(DA_UPLOADS_PREFIX) || !url.toLowerCase().endsWith(".pdf")) {
        return json({ error: `send pdfBase64, or a url to a PDF under ${DA_UPLOADS_PREFIX}` }, 400);
      }
      return json(await parsePdf(await fetchPdf(url)));
    }
    if (body?.action === "ingest") {
      // Only the scheduled job: without the secret this is a public write.
      if (!DA_CRON_SECRET || req.headers.get("x-cron-secret") !== DA_CRON_SECRET) {
        return json({ error: "not allowed" }, 401);
      }
      const url = body.url;
      if (typeof url !== "string" || !url.startsWith(DA_UPLOADS_PREFIX)) {
        return json({ error: `send the PDF's url (under ${DA_UPLOADS_PREFIX}) with pdfBase64` }, 400);
      }
      if (typeof body.pdfBase64 !== "string" || body.pdfBase64.length === 0) {
        return json({ error: "send pdfBase64" }, 400);
      }
      return json(await savePrices(await parsePdf(decodeBase64(body.pdfBase64)), url));
    }
    return json({ error: "action must be \"list\", \"parse\" or \"ingest\"" }, 400);
  } catch (err) {
    return json({ error: err instanceof Error ? err.message : String(err) }, 500);
  }
});
