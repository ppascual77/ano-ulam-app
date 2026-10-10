// DA Daily Price Index reader, no DB access (same contract as the
// grounding functions): it lists and parses DA's PDFs, and the admin's
// confirmed save is a separate client-side write (api/daPrices.ts). No
// secret is involved; this is an edge function because PDF parsing needs
// pdf.js, which is heavy and awkward to run on the device.
//
//   { action: "list" }        → the newest Daily Price Index PDFs on DA's page
//   { action: "parse", url }  → { date, rows } for one PDF (see parse.ts)

import { getDocumentProxy } from "npm:unpdf@0.12.1";
import { DA_UPLOADS_PREFIX, listDailyPdfs, parseDailyPriceIndex, type ListedPdf, type TextItem } from "./parse.ts";

const DA_PRICE_PAGE = "https://www.da.gov.ph/price-monitoring/";
const LIST_LIMIT = 14;
// DA's site rejects requests without a browser-like user agent.
const FETCH_HEADERS = { "User-Agent": "Mozilla/5.0 (AnoUlam admin)" };

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

async function listPdfs(): Promise<ListedPdf[]> {
  const res = await fetch(DA_PRICE_PAGE, { headers: FETCH_HEADERS });
  if (!res.ok) throw new Error(`DA price monitoring page returned ${res.status}`);
  return listDailyPdfs(await res.text(), LIST_LIMIT);
}

async function parsePdf(url: string) {
  const res = await fetch(url, { headers: FETCH_HEADERS });
  if (!res.ok) throw new Error(`DA PDF returned ${res.status}`);
  const pdf = await getDocumentProxy(new Uint8Array(await res.arrayBuffer()));

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
      const url = body.url;
      if (typeof url !== "string" || !url.startsWith(DA_UPLOADS_PREFIX) || !url.toLowerCase().endsWith(".pdf")) {
        return json({ error: `url must be a PDF under ${DA_UPLOADS_PREFIX}` }, 400);
      }
      return json(await parsePdf(url));
    }
    return json({ error: "action must be \"list\" or \"parse\"" }, 400);
  } catch (err) {
    return json({ error: err instanceof Error ? err.message : String(err) }, 500);
  }
});
