import { invokeEdgeFunction } from "@/lib/supabase";

// Klipy GIF/sticker search, through the `klipy` edge function so the Klipy
// key stays a server secret (supabase/functions/klipy). Signed-in only, like
// the Community feed it's for. Same results as the web app's
// KlipyGifPicker/KlipyStickerPicker.

export type KlipyKind = "gifs" | "stickers";

export type KlipyItem = {
  slug: string;
  title: string;
  /** What gets attached to the post (Klipy's "sm" webp, as on the web). */
  url: string;
  /** Smaller "xs" webp for the picker grid. */
  previewUrl: string;
};

// Trending when `query` is empty, search otherwise (safe-content filtered).
export async function fetchKlipy(kind: KlipyKind, query: string): Promise<KlipyItem[]> {
  const { items } = await invokeEdgeFunction<{ items: KlipyItem[] }>("klipy", { kind, query: query.trim() });
  return items;
}
