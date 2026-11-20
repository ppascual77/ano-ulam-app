import { supabase } from "@/lib/supabase";

// Admin → Manage Users: the user list (read-only), through
// admin_list_users (refuses anyone but an admin). Same columns as the web
// admin's Manage Users page.

/** subscriber: paying (or in a trial); earned: only Pro reward days. */
export type AdminUserPlan = "subscriber" | "earned" | "free";

export type AdminUser = {
  id: string;
  displayName: string | null;
  email: string | null;
  avatarUrl: string | null;
  isAdmin: boolean;
  plan: AdminUserPlan;
  proUntil: string | null;
  proRewardUntil: string | null;
  newsletterSubscribed: boolean;
  createdAt: string;
  lastSignInAt: string | null;
};

export const ADMIN_USERS_PAGE = 50;

export async function listAdminUsers(params: {
  query?: string;
  plan?: "free" | "pro";
  offset?: number;
}): Promise<{ users: AdminUser[]; total: number }> {
  const { data, error } = await supabase.rpc("admin_list_users", {
    p_query: params.query?.trim() || undefined,
    p_plan: params.plan,
    p_offset: params.offset ?? 0,
    p_limit: ADMIN_USERS_PAGE,
  });
  if (error) throw error;
  // The generated types call every column non-null; they aren't.
  const users = data.map(
    (row): AdminUser => ({
      id: row.id,
      displayName: row.display_name ?? null,
      email: row.email ?? null,
      avatarUrl: row.avatar_url ?? null,
      isAdmin: row.role === "admin",
      plan: row.plan === "subscriber" || row.plan === "earned" ? row.plan : "free",
      proUntil: row.pro_until ?? null,
      proRewardUntil: row.pro_reward_until ?? null,
      newsletterSubscribed: !!row.newsletter_subscribed,
      createdAt: row.created_at,
      lastSignInAt: row.last_sign_in_at ?? null,
    }),
  );
  return { users, total: Number(data[0]?.total_count ?? 0) };
}
