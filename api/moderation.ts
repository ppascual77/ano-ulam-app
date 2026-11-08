import { supabase } from "@/lib/supabase";
import type { Database } from "@/lib/database.types";
import type { ReportReason } from "./posts";

// Admin moderation of Food Posts. Every function checks is_admin() in the
// database (app_metadata role), so calling them without it just fails.

type ReportedRow = Database["public"]["Functions"]["get_reported_posts"]["Returns"][number];

export type ReportedPost = {
  id: string;
  userId: string;
  displayName: string | null;
  avatarUrl: string | null;
  caption: string | null;
  imageUrl: string | null;
  linkUrl: string | null;
  gifUrl: string | null;
  stickerUrl: string | null;
  createdAt: string;
  /** Already hidden (3 reports, or an admin). */
  hidden: boolean;
  reportCount: number;
  reasons: ReportReason[];
  notes: string[];
  lastReportedAt: string;
};

// The generated types call every returned column non-null; they aren't.
const toReported = (row: ReportedRow): ReportedPost => ({
  id: row.id,
  userId: row.user_id,
  displayName: row.display_name ?? null,
  avatarUrl: row.avatar_url ?? null,
  caption: row.caption ?? null,
  imageUrl: row.image_url ?? null,
  linkUrl: row.link_url ?? null,
  gifUrl: row.gif_url ?? null,
  stickerUrl: row.sticker_url ?? null,
  createdAt: row.created_at,
  hidden: !!row.hidden,
  reportCount: row.report_count ?? 0,
  reasons: (row.reasons ?? []) as ReportReason[],
  notes: row.notes ?? [],
  lastReportedAt: row.last_reported_at,
});

/** Posts with open reports, most reported first. */
export async function getReportedPosts(): Promise<ReportedPost[]> {
  const { data, error } = await supabase.rpc("get_reported_posts");
  if (error) throw error;
  return (data ?? []).map(toReported);
}

/** Hides a post for everyone and closes its reports. */
export async function removePost(postId: string): Promise<void> {
  const { error } = await supabase.rpc("remove_post", { p_post: postId });
  if (error) throw error;
}

/** The post is fine: closes its reports and shows it again. */
export async function dismissPostReports(postId: string): Promise<void> {
  const { error } = await supabase.rpc("dismiss_post_reports", { p_post: postId });
  if (error) throw error;
}
