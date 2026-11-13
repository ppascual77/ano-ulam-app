// Klipy GIF/sticker search for the Community post sheet (KlipyPicker), so
// the Klipy key stays a server secret instead of shipping in the app.
// Signed-in users only (the feed is too), so the anon key can't run up the
// quota. Same endpoints and params the app used directly before.
//
// POST { kind: "gifs" | "stickers", query?: string }
//   -> { items: [{ slug, title, url, previewUrl }] }
// Trending when `query` is empty, search otherwise. content_filter=high is
// Klipy's strictest safe-content filter.
//
// Secret: KLIPY_API_KEY (supabase secrets set KLIPY_API_KEY=...).
import { requireUser } from "../_shared/requireUser.ts";

const KLIPY_API_KEY = Deno.env.get("KLIPY_API_KEY");
const PER_PAGE = 24;
const MAX_QUERY = 100;

type KlipyResponse = {
  data?: {
    data?: {
      slug: string;
      title: string;
      file: { sm: { webp: { url: string } }; xs: { webp: { url: string } } };
    }[];
  };
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") return json({ error: "POST only" }, 405);
  const denied = await requireUser(req);
  if (denied) return denied;
  if (!KLIPY_API_KEY) return json({ error: "KLIPY_API_KEY not configured" }, 500);

  let body: { kind?: unknown; query?: unknown };
  try {
    body = await req.json();
  } catch {
    return json({ error: "send JSON" }, 400);
  }
  const kind = body.kind;
  if (kind !== "gifs" && kind !== "stickers") return json({ error: 'kind must be "gifs" or "stickers"' }, 400);
  const q = typeof body.query === "string" ? body.query.trim().slice(0, MAX_QUERY) : "";

  const base = `https://api.klipy.com/api/v1/${KLIPY_API_KEY}/${kind}`;
  const params = `per_page=${PER_PAGE}&content_filter=high&format_filter=webp`;
  const url = q ? `${base}/search?q=${encodeURIComponent(q)}&${params}` : `${base}/trending?${params}`;

  try {
    const res = await fetch(url);
    if (!res.ok) return json({ error: `Klipy request failed: ${res.status}` }, 502);
    const data = (await res.json()) as KlipyResponse;
    const items = (data.data?.data ?? []).flatMap((item) =>
      item.file?.sm?.webp?.url && item.file?.xs?.webp?.url
        ? [{ slug: item.slug, title: item.title, url: item.file.sm.webp.url, previewUrl: item.file.xs.webp.url }]
        : [],
    );
    return json({ items });
  } catch (err) {
    return json({ error: err instanceof Error ? err.message : String(err) }, 502);
  }
});
