import { supabase } from "@/lib/supabase";

// Blocking other users (App Store Guideline 1.2). A blocked person's posts
// leave your feed and their profile's posts (get_food_posts skips them).
// Private: they aren't told. Rows are only ever the caller's own (RLS).

export type BlockedUser = { user_id: string; display_name: string | null; avatar_url: string | null; blocked_at: string };

async function currentUserId() {
  const { data } = await supabase.auth.getSession();
  const id = data.session?.user.id;
  if (!id) throw new Error("Not signed in");
  return id;
}

export async function blockUser(userId: string): Promise<void> {
  const blocker = await currentUserId();
  const { error } = await supabase.from("user_blocks").insert({ blocker_id: blocker, blocked_id: userId });
  // Already blocked.
  if (error && error.code !== "23505") throw error;
}

export async function unblockUser(userId: string): Promise<void> {
  const blocker = await currentUserId();
  const { error } = await supabase.from("user_blocks").delete().eq("blocker_id", blocker).eq("blocked_id", userId);
  if (error) throw error;
}

/** The people the signed-in user blocked, newest first. */
export async function getBlockedUsers(): Promise<BlockedUser[]> {
  const { data, error } = await supabase.rpc("get_blocked_users");
  if (error) throw error;
  return data ?? [];
}
