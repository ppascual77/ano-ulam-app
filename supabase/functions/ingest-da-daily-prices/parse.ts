// Parser for DA's "Daily Price Index" PDF (NCR). Pure: takes the text items
// pdf.js reports per page (string + position) and returns rows, so it can be
// tested outside Deno against real PDFs.
//
// Why positions and not the flat text: flattened, "Beef Rump, Local Lean
// Meat/ Tapadera 499.46" has no reliable commodity/specification split, and
// long rows wrap onto two lines ("Pork Picnic Shoulder (Kasim)," / "Local")
// with the price printed vertically centered between them. In the table the
// three columns sit at fixed x positions, so rows are rebuilt from the
// commodity column and each price and spec line joins the row nearest it.

export type TextItem = { str: string; x: number; y: number; width: number };

export type DaUnit = "kg" | "piece" | "bottle";

export type DaRow = {
  commodity: string;
  specification: string;
  section: string | null;
  unit: DaUnit;
  // Liters per bottle (oil) or grams per piece (eggs); null when the
  // specification doesn't say.
  unitSize: number | null;
  // null for "n/a" or an empty price cell (DA uses both).
  price: number | null;
};

export type DaParseResult = { date: string; rows: DaRow[] };

export type ListedPdf = { date: string; url: string; revised: boolean };

// Only DA's own uploads, so the function can't be used to fetch arbitrary URLs.
export const DA_UPLOADS_PREFIX = "https://www.da.gov.ph/wp-content/uploads/";

const MONTHS = [
  "january", "february", "march", "april", "may", "june",
  "july", "august", "september", "october", "november", "december",
];

// Rows are ~20pt apart; a price or wrapped spec line sits within ~7pt of
// its row.
const ROW_TOLERANCE = 10;
// Max gap between two lines of one wrapped commodity or section header
// ("OTHER LIVESTOCK MEAT" / "PRODUCTS").
const LINE_GAP = 16;

const clean = (s: string) => s.replace(/\s+/g, " ").replace(/\s+,/g, ",").trim();

// Items on one baseline, left to right, joined with a space only where
// there's a visible gap: pdf.js splits some words ("T" "hur" "s" "day").
function joinLine(items: TextItem[]): string {
  const sorted = [...items].sort((a, b) => a.x - b.x);
  let out = "";
  let end = -Infinity;
  for (const it of sorted) {
    out += (it.x - end > 1.5 && out ? " " : "") + it.str;
    end = it.x + it.width;
  }
  return out;
}

function lines(items: TextItem[]): { y: number; text: string }[] {
  const byY = new Map<number, TextItem[]>();
  for (const it of items) {
    const y = Math.round(it.y);
    byY.set(y, [...(byY.get(y) ?? []), it]);
  }
  return [...byY.entries()].sort((a, b) => b[0] - a[0]).map(([y, its]) => ({ y, text: joinLine(its) }));
}

function parseDate(pageText: string): string | null {
  const m = pageText.match(
    /\b(january|february|march|april|may|june|july|august|september|october|november|december)\s+(\d{1,2}),\s*(\d{4})/i,
  );
  if (!m) return null;
  const month = MONTHS.indexOf(m[1].toLowerCase()) + 1;
  return `${m[3]}-${String(month).padStart(2, "0")}-${m[2].padStart(2, "0")}`;
}

function inferUnit(commodity: string, specification: string): { unit: DaUnit; unitSize: number | null } {
  if (/\begg\b/i.test(commodity)) {
    // "56-60 grams/pc" → 58; "71> grams/pc" → 71.
    const range = specification.match(/(\d+)\s*-\s*(\d+)\s*grams/i);
    if (range) return { unit: "piece", unitSize: (Number(range[1]) + Number(range[2])) / 2 };
    const single = specification.match(/(\d+)\s*>?\s*grams/i);
    return { unit: "piece", unitSize: single ? Number(single[1]) : null };
  }
  if (/cooking oil/i.test(commodity)) {
    const ml = specification.match(/(\d+(?:\.\d+)?)\s*ml/i);
    if (ml) return { unit: "bottle", unitSize: Number(ml[1]) / 1000 };
    const liter = specification.match(/(\d+(?:\.\d+)?)\s*(?:liter|litre|l)\b/i);
    return { unit: "bottle", unitSize: liter ? Number(liter[1]) : null };
  }
  return { unit: "kg", unitSize: null };
}

const isPrice = (s: string) => /^(\d{1,3}(,\d{3})*|\d+)(\.\d+)?$|^n\/a$/i.test(s.trim());
const isHeaderText = (s: string) => /[A-Z]/.test(s) && s === s.toUpperCase();

export function parseDailyPriceIndex(pages: TextItem[][]): DaParseResult {
  const firstPageText = lines(pages[0] ?? []).map((l) => l.text).join("\n");
  if (!/daily price index/i.test(firstPageText)) {
    throw new Error("Not a DA Daily Price Index PDF (no \"DAILY PRICE INDEX\" title on page 1)");
  }
  if (!/national capital region/i.test(firstPageText)) {
    throw new Error("Only the NCR Daily Price Index is supported");
  }
  const date = parseDate(firstPageText);
  if (!date) throw new Error("Couldn't find the date line on page 1, e.g. \"(Thursday, October 8, 2026)\"");

  type Entry = { order: number; kind: "header"; text: string } | { order: number; kind: "row"; row: Omit<DaRow, "section"> };
  const entries: Entry[] = [];

  pages.forEach((items, pageIndex) => {
    const find = (re: RegExp) => items.find((it) => re.test(it.str.trim()));
    const commodityHeader = find(/^COMMODITY$/);
    const specHeader = find(/^SPECIFICATION$/);
    const priceHeader = find(/^RETAIL PRICE PER$/i);
    if (!commodityHeader || !specHeader || !priceHeader) return; // not a table page

    const tableTop = Math.min(...items.filter((it) => /^UNIT \(P\/UNIT\)$|^COMMODITY$/.test(it.str.trim())).map((it) => it.y));
    const notesY = find(/^Note\(s\)/i)?.y ?? -Infinity;
    const footerY = find(/^Page$/)?.y ?? -Infinity;
    // Headers are centered over their columns, so split at the midpoint
    // between them rather than at the header's own x.
    const specMinX = (commodityHeader.x + specHeader.x) / 2;
    const priceMinX = priceHeader.x - 10;

    const body = items.filter((it) => it.str.trim() && it.y < tableTop - 2 && it.y > notesY + 2 && it.y > footerY + 2);
    const prices = body.filter((it) => it.x >= priceMinX && isPrice(it.str));
    const commodityLines = lines(body.filter((it) => it.x < specMinX));
    const specLines = lines(body.filter((it) => it.x >= specMinX && it.x < priceMinX));
    const nearPrice = (y: number) => prices.some((p) => Math.abs(p.y - y) <= ROW_TOLERANCE);

    // Rows from the commodity column, top to bottom. Gaps can't tell a
    // wrapped line from the next row (14pt vs 15pt on Oct 9, 2026, where
    // prices are top-aligned instead of centered), so a line continues the
    // row above only when that row's text is visibly unfinished.
    type PageRow = { top: number; bottom: number; commodity: string[]; spec: string[]; price: TextItem | null };
    const pageRows: PageRow[] = [];
    const headers: { top: number; bottom: number; text: string }[] = [];
    let last: "row" | "header" | null = null;
    for (const line of commodityLines) {
      if (isHeaderText(line.text) && !nearPrice(line.y)) {
        const prev = headers.at(-1);
        if (last === "header" && prev && prev.bottom - line.y <= LINE_GAP) {
          prev.text = `${prev.text} ${line.text}`;
          prev.bottom = line.y;
        } else {
          headers.push({ top: line.y, bottom: line.y, text: line.text });
        }
        last = "header";
        continue;
      }
      const prev = pageRows.at(-1);
      if (last === "row" && prev && prev.bottom - line.y <= LINE_GAP && isUnfinished(prev.commodity.join(" "))) {
        prev.commodity.push(line.text);
        prev.bottom = line.y;
      } else {
        pageRows.push({ top: line.y, bottom: line.y, commodity: [line.text], spec: [], price: null });
      }
      last = "row";
    }

    // Prices and specification lines go to the row whose vertical span
    // they're nearest (0 when inside it, e.g. a centered price).
    const nearestRow = (y: number) => {
      let best: PageRow | null = null;
      let bestDistance = Infinity;
      for (const row of pageRows) {
        const distance = y > row.top ? y - row.top : y < row.bottom ? row.bottom - y : 0;
        if (distance < bestDistance) [best, bestDistance] = [row, distance];
      }
      return bestDistance <= ROW_TOLERANCE ? best : null;
    };
    for (const line of specLines) nearestRow(line.y)?.spec.push(line.text);
    for (const p of prices) {
      const row = nearestRow(p.y);
      if (row && !row.price) row.price = p;
    }

    const order = (y: number) => pageIndex * 10000 + (10000 - y);
    for (const h of headers) entries.push({ order: order(h.top), kind: "header", text: clean(h.text) });
    for (const r of pageRows) {
      const commodity = joinWrapped(r.commodity);
      const specification = joinWrapped(r.spec);
      const raw = r.price?.str.trim() ?? "n/a";
      const price = /n\/a/i.test(raw) ? null : Number(raw.replace(/,/g, ""));
      entries.push({ order: order(r.top), kind: "row", row: { commodity, specification, ...inferUnit(commodity, specification), price } });
    }
  });

  entries.sort((a, b) => a.order - b.order);
  const rows: DaRow[] = [];
  let section: string | null = null;
  for (const e of entries) {
    if (e.kind === "header") section = e.text;
    else rows.push(qualifyRice({ ...e.row, section }));
  }

  // Each (commodity, specification) must be unique, it's the DB key. If DA
  // ever repeats one outside the rice sections, keep both apart by section
  // rather than letting the later one overwrite the earlier.
  const seen = new Set<string>();
  for (const row of rows) {
    const key = `${row.commodity}|${row.specification}`;
    if (seen.has(key) && row.section) {
      row.specification = clean(`${row.specification} (${titleCase(row.section)})`);
    }
    seen.add(`${row.commodity}|${row.specification}`);
  }

  if (rows.filter((r) => r.price != null).length === 0) {
    throw new Error("Found no priced rows; the PDF layout may have changed");
  }
  return { date, rows };
}

// Ends in "," "-" "(" "/" or leaves a parenthesis open: "Tambakol
// (Yellow-Fin Tuna)," / "Cooking Oil (Palm Olein, Jolly".
function isUnfinished(text: string): boolean {
  const t = text.trim();
  return /[,(\-/]$/.test(t) || (t.match(/\(/g)?.length ?? 0) > (t.match(/\)/g)?.length ?? 0);
}

// "(150-" + "300 gm)" → "(150-300 gm)", not "(150- 300 gm)".
function joinWrapped(parts: string[]): string {
  return clean(parts.reduce((acc, p) => (acc.endsWith("-") ? acc + p.trim() : `${acc} ${p}`), ""));
}

const titleCase = (s: string) => s.toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());

// Imported and Local commercial rice repeat the same grades ("Premium",
// "Well Milled"), told apart only by section. Name them the way DA names
// every other variant: "Premium Rice, Imported".
function qualifyRice(row: DaRow): DaRow {
  const origin = row.section?.match(/^(IMPORTED|LOCAL) COMMERCIAL RICE$/)?.[1];
  if (!origin) return row;
  const base = /rice/i.test(row.commodity) ? row.commodity : `${row.commodity} Rice`;
  return { ...row, commodity: `${base}, ${titleCase(origin)}` };
}

// Filenames aren't consistent ("Daily-Price-Index-October-8-2026.pdf",
// "Revised-Daily-Price-Index-October-7-2026.pdf",
// "October-9-2026-DPI-AFC.pdf"), so the date is read from whichever
// "Month-Day-Year" appears in the name rather than from a fixed pattern.
function dateFromFilename(url: string): string | null {
  const name = decodeURIComponent(url.split("/").pop() ?? "");
  const m = name.match(/(january|february|march|april|may|june|july|august|september|october|november|december)-(\d{1,2})-(\d{4})/i);
  if (!m) return null;
  const month = MONTHS.indexOf(m[1].toLowerCase()) + 1;
  return `${m[3]}-${String(month).padStart(2, "0")}-${m[2].padStart(2, "0")}`;
}

// The Daily Price Index PDFs linked from DA's price monitoring page, one
// per day, newest first.
export function listDailyPdfs(html: string, limit: number): ListedPdf[] {
  const byDate = new Map<string, ListedPdf>();
  for (const [, url] of html.matchAll(/href="([^"]+\.pdf)"/gi)) {
    if (!url.startsWith(DA_UPLOADS_PREFIX) || !/daily-price-index|dpi/i.test(url)) continue;
    const date = dateFromFilename(url);
    if (!date) continue;
    const revised = /revised/i.test(url);
    const existing = byDate.get(date);
    // A "Revised" PDF replaces the original for its day. Otherwise keep the
    // first link, the page lists newest uploads first.
    if (!existing || (revised && !existing.revised)) byDate.set(date, { date, url, revised });
  }
  return [...byDate.values()].sort((a, b) => b.date.localeCompare(a.date)).slice(0, limit);
}
