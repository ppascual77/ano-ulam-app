// Klipy GIF/sticker search, same endpoints and params as the web app's
// KlipyGifPicker/KlipyStickerPicker. Client-side for now: the key is an
// EXPO_PUBLIC_ value baked into the bundle (the web app's dev key, same
// exposure as its VITE_KLIPY_API_KEY). Before release this should move
// behind a Supabase edge function with a separate mobile key.

const KLIPY_API_KEY = process.env.EXPO_PUBLIC_KLIPY_API_KEY;

export type KlipyKind = "gifs" | "stickers";

export type KlipyItem = {
  slug: string;
  title: string;
  /** What gets attached to the post (Klipy's "sm" webp, as on the web). */
  url: string;
  /** Smaller "xs" webp for the picker grid. */
  previewUrl: string;
};

type KlipyResponse = {
  data?: {
    data?: {
      slug: string;
      title: string;
      file: { sm: { webp: { url: string } }; xs: { webp: { url: string } } };
    }[];
  };
};

// Trending when `query` is empty, search otherwise. content_filter=high is
// Klipy's strictest safe-content filter.
export async function fetchKlipy(kind: KlipyKind, query: string): Promise<KlipyItem[]> {
  if (!KLIPY_API_KEY) throw new Error("EXPO_PUBLIC_KLIPY_API_KEY isn't set");
  const base = `https://api.klipy.com/api/v1/${KLIPY_API_KEY}/${kind}`;
  const q = query.trim();
  const url = q
    ? `${base}/search?q=${encodeURIComponent(q)}&per_page=24&content_filter=high&format_filter=webp`
    : `${base}/trending?per_page=24&content_filter=high&format_filter=webp`;

  const res = await fetch(url);
  if (!res.ok) throw new Error(`Klipy request failed: ${res.status}`);
  const json = (await res.json()) as KlipyResponse;
  return (json.data?.data ?? []).map((item) => ({
    slug: item.slug,
    title: item.title,
    url: item.file.sm.webp.url,
    previewUrl: item.file.xs.webp.url,
  }));
}
