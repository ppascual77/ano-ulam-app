import { supabase } from "@/lib/supabase";
import type { Database } from "@/lib/database.types";

// Community food posts (public.food_posts) and their likes
// (public.food_post_likes). Lists go through the get_food_posts database
// function, which adds each author's name and avatar (users stays
// owner-only), the like count and whether you liked it. Signed-in only.

type FeedRow = Database["public"]["Functions"]["get_food_posts"]["Returns"][number];

export type FoodPost = {
  id: string;
  user_id: string;
  display_name: string | null;
  avatar_url: string | null;
  caption: string | null;
  image_url: string | null;
  link_url: string | null;
  link_title: string | null;
  link_description: string | null;
  link_image: string | null;
  gif_url: string | null;
  sticker_url: string | null;
  created_at: string;
  like_count: number;
  /** Whether the signed-in user liked it. */
  liked: boolean;
  /** Removed by moderation (an admin, or 3 reports). Only its poster still
   *  gets it, so the app can label it. */
  hidden: boolean;
};

/** Why a post was reported (post_reports.reason). */
export type ReportReason = "spam" | "not_food" | "offensive" | "misleading" | "other";

export type PostInput = {
  caption: string;
  /** A local file uri (newly picked, uploaded on save) or the post's
   *  current photo URL (kept). */
  image_uri?: string | null;
  link_url?: string | null;
  gif_url?: string | null;
  sticker_url?: string | null;
};

const BUCKET = "post-images";

async function currentUserId() {
  const { data } = await supabase.auth.getSession();
  const id = data.session?.user.id;
  if (!id) throw new Error("Not signed in");
  return id;
}

// The generated types call every returned column non-null; they aren't.
function toPost(row: FeedRow): FoodPost {
  return {
    id: row.id,
    user_id: row.user_id,
    display_name: row.display_name ?? null,
    avatar_url: row.avatar_url ?? null,
    caption: row.caption ?? null,
    image_url: row.image_url ?? null,
    link_url: row.link_url ?? null,
    link_title: row.link_title ?? null,
    link_description: row.link_description ?? null,
    link_image: row.link_image ?? null,
    gif_url: row.gif_url ?? null,
    sticker_url: row.sticker_url ?? null,
    created_at: row.created_at,
    like_count: row.like_count ?? 0,
    liked: !!row.liked,
    hidden: !!row.hidden,
  };
}

async function listPosts(userId: string | null, offset: number, limit: number): Promise<FoodPost[]> {
  const { data, error } = await supabase.rpc("get_food_posts", {
    ...(userId ? { p_user_id: userId } : {}),
    p_offset: offset,
    p_limit: limit,
  });
  if (error) throw error;
  return data.map(toPost);
}

/** The Community feed, newest first, one page at a time. */
export function listCommunityPosts(offset: number, limit = 5): Promise<FoodPost[]> {
  return listPosts(null, offset, limit);
}

/** One user's posts (a profile), newest first, one page at a time. */
export function listUserPosts(userId: string, offset: number, limit = 10): Promise<FoodPost[]> {
  return listPosts(userId, offset, limit);
}

/** How many posts a user has made (their profile's stats row). Counted
 *  without fetching rows. */
export async function countUserPosts(userId: string): Promise<number> {
  const { count, error } = await supabase
    .from("food_posts")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId);
  if (error) throw error;
  return count ?? 0;
}

// ---- photos ----------------------------------------------------------------

const isLocalUri = (uri: string) => !/^https?:\/\//i.test(uri);

// Uploads a picked photo (expo-image-picker's file:// uri) under the user's
// own folder and returns its public URL.
async function uploadPostImage(localUri: string, userId: string): Promise<string> {
  const response = await fetch(localUri);
  const blob = await response.blob();
  const ext = localUri.split(".").pop()?.toLowerCase().split("?")[0] || "jpg";
  const path = `${userId}/${Date.now()}.${ext}`;
  const { error } = await supabase.storage.from(BUCKET).upload(path, blob, {
    contentType: blob.type || `image/${ext}`,
  });
  if (error) throw error;
  return supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
}

// The bucket path of a photo we host, or null for anything else.
function storagePath(url: string | null): string | null {
  if (!url) return null;
  const marker = `/storage/v1/object/public/${BUCKET}/`;
  const at = url.indexOf(marker);
  return at === -1 ? null : decodeURIComponent(url.slice(at + marker.length).split("?")[0]);
}

// Best effort: a leftover photo isn't worth failing a delete or an edit.
async function removePostImage(url: string | null) {
  const path = storagePath(url);
  if (!path) return;
  try {
    await supabase.storage.from(BUCKET).remove([path]);
  } catch {
    // keep going
  }
}

// ---- link previews -----------------------------------------------------------

type LinkFields = Pick<FoodPost, "link_url" | "link_title" | "link_description" | "link_image">;

const NO_LINK: LinkFields = { link_url: null, link_title: null, link_description: null, link_image: null };

const withScheme = (url: string) => (/^https?:\/\//i.test(url) ? url : `https://${url}`);

function hostnameOf(url: string) {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

const decodeEntities = (text: string) =>
  text
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;|&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#(\d+);/g, (_m, code: string) => String.fromCharCode(Number(code)))
    .trim();

function metaContent(html: string, key: string): string | null {
  // <meta property="og:title" content="..."> in either attribute order.
  const patterns = [
    new RegExp(`<meta[^>]+(?:property|name)=["']${key}["'][^>]*content=["']([^"']*)["']`, "i"),
    new RegExp(`<meta[^>]+content=["']([^"']*)["'][^>]*(?:property|name)=["']${key}["']`, "i"),
  ];
  for (const pattern of patterns) {
    const match = html.match(pattern);
    if (match?.[1]) return decodeEntities(match[1]);
  }
  return null;
}

// Reads the page's Open Graph tags on the device (no CORS in the app). Falls
// back to the hostname as the title when the page can't be read in time.
async function fetchLinkPreview(rawUrl: string): Promise<LinkFields> {
  const url = withScheme(rawUrl.trim());
  const fallback: LinkFields = { link_url: url, link_title: hostnameOf(url), link_description: null, link_image: null };
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 5000);
  try {
    const response = await fetch(url, { signal: controller.signal, headers: { Accept: "text/html" } });
    if (!response.ok) return fallback;
    // Only the head matters; cap what's scanned.
    const html = (await response.text()).slice(0, 200_000);
    const titleTag = html.match(/<title[^>]*>([^<]*)<\/title>/i)?.[1];
    const title =
      metaContent(html, "og:title") ?? metaContent(html, "twitter:title") ?? (titleTag ? decodeEntities(titleTag) : null);
    const description = metaContent(html, "og:description") ?? metaContent(html, "description");
    let image = metaContent(html, "og:image") ?? metaContent(html, "twitter:image");
    if (image) {
      try {
        image = new URL(image, response.url || url).toString();
      } catch {
        image = null;
      }
    }
    return {
      link_url: url,
      link_title: title || fallback.link_title,
      link_description: description || null,
      link_image: image && /^https?:\/\//i.test(image) ? image : null,
    };
  } catch {
    return fallback;
  } finally {
    clearTimeout(timer);
  }
}

// ---- writes ------------------------------------------------------------------

function contentFields(input: PostInput) {
  return {
    caption: input.caption.trim() || null,
    gif_url: input.gif_url ?? null,
    sticker_url: input.sticker_url ?? null,
  };
}

/** A new post by the signed-in user. Uploads the photo and reads the link's
 *  preview first. */
export async function createPost(input: PostInput): Promise<void> {
  const userId = await currentUserId();
  const [imageUrl, link] = await Promise.all([
    input.image_uri ? (isLocalUri(input.image_uri) ? uploadPostImage(input.image_uri, userId) : input.image_uri) : null,
    input.link_url ? fetchLinkPreview(input.link_url) : NO_LINK,
  ]);
  const { error } = await supabase.from("food_posts").insert({ user_id: userId, image_url: imageUrl, ...contentFields(input), ...link });
  if (error) {
    await removePostImage(imageUrl === input.image_uri ? null : imageUrl);
    throw error;
  }
}

/** Edits your post. A new photo is uploaded (the old one removed); the link
 *  preview is read again only when the link changed. */
export async function updatePost(previous: FoodPost, input: PostInput): Promise<void> {
  const userId = await currentUserId();
  const newPhoto = !!input.image_uri && isLocalUri(input.image_uri);
  const sameLink = !!input.link_url && !!previous.link_url && withScheme(input.link_url.trim()) === previous.link_url;
  const [imageUrl, link] = await Promise.all([
    newPhoto ? uploadPostImage(input.image_uri!, userId) : (input.image_uri ?? null),
    !input.link_url
      ? NO_LINK
      : sameLink
        ? {
            link_url: previous.link_url,
            link_title: previous.link_title,
            link_description: previous.link_description,
            link_image: previous.link_image,
          }
        : fetchLinkPreview(input.link_url),
  ]);
  const { error } = await supabase
    .from("food_posts")
    .update({ image_url: imageUrl, ...contentFields(input), ...link })
    .eq("id", previous.id);
  if (error) {
    if (newPhoto) await removePostImage(imageUrl);
    throw error;
  }
  if (previous.image_url && previous.image_url !== imageUrl) await removePostImage(previous.image_url);
}

/** Deletes your post (its likes go with it) and its photo. */
export async function deletePost(post: Pick<FoodPost, "id" | "image_url">): Promise<void> {
  const { error } = await supabase.from("food_posts").delete().eq("id", post.id);
  if (error) throw error;
  await removePostImage(post.image_url);
}

/** Likes or unlikes a post as the signed-in user. Safe to repeat. */
export async function setPostLiked(postId: string, liked: boolean): Promise<void> {
  const userId = await currentUserId();
  if (liked) {
    const { error } = await supabase.from("food_post_likes").insert({ post_id: postId, user_id: userId });
    // Already liked.
    if (error && error.code !== "23505") throw error;
  } else {
    const { error } = await supabase.from("food_post_likes").delete().eq("post_id", postId).eq("user_id", userId);
    if (error) throw error;
  }
}

/** Reports someone else's post. It leaves the reporter's feed straight
 *  away; 3 open reports hide it for everyone until an admin reviews it. */
export async function reportPost(postId: string, reason: ReportReason, note?: string): Promise<void> {
  const { error } = await supabase.rpc("report_post", { p_post: postId, p_reason: reason, p_note: note?.trim() || undefined });
  if (error) throw error;
}
