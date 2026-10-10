// DA Daily Price Index reader, no DB access (same contract as the
// grounding functions): it lists and parses DA's PDFs, and the admin's
// confirmed save is a separate client-side write (api/daPrices.ts). No
// secret is involved; this is an edge function because PDF parsing needs
// pdf.js, which is heavy and awkward to run on the device.
//
//   { action: "list" }              → the newest Daily Price Index PDFs on DA's page
//   { action: "parse", pdfBase64 }  → { date, rows } for one PDF (see parse.ts)
//   { action: "parse", url }        → same, fetching the PDF here
//
// The app sends pdfBase64: DA's site throttles or blocks this server's IPs
// on PDF downloads (timeouts here while instant from a phone), so the app
// downloads the PDF itself. The url form is kept for testing.

import { getDocumentProxy } from "npm:unpdf@0.12.1";
import { DA_UPLOADS_PREFIX, listDailyPdfs, parseDailyPriceIndex, type ListedPdf, type TextItem } from "./parse.ts";

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

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") return json({ error: "POST only" }, 405);

  try {
    const body = await req.json();
    if (body?.action === "list") {
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
    return json({ error: "action must be \"list\" or \"parse\"" }, 400);
  } catch (err) {
    return json({ error: err instanceof Error ? err.message : String(err) }, 500);
  }
});
