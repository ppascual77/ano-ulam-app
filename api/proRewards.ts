import { supabase } from "@/lib/supabase";

/** One Pro reward granted to this user (pro_rewards: each kind once). */
export type ProReward = {
  id: string;
  kind: "recipe" | "photo_post";
  days: number;
  grantedAt: string;
};

/** This user's granted Pro rewards, oldest first (own rows only). The days
 *  are granted by the database (the pro_rewards migration). */
export async function getProRewards(userId: string): Promise<ProReward[]> {
  const { data, error } = await supabase
    .from("pro_rewards")
    .select("id, kind, days, granted_at")
    .eq("user_id", userId)
    .order("granted_at");
  if (error) throw error;
  return (data ?? []).map((row) => ({ id: row.id, kind: row.kind as ProReward["kind"], days: row.days, grantedAt: row.granted_at }));
}

/** Which Pro rewards this user has claimed, from the reward log itself,
 *  not from recipes and posts: rewards started 2026-11-08 with no backfill,
 *  so an older approved recipe or photo post hasn't earned anything. */
export type ProRewardProgress = {
  /** Their first approved recipe earned its days (0 or 1). */
  approvedRecipes: number;
  /** Their first photo post earned its days. */
  hasPhotoPost: boolean;
};

export const progressOf = (rewards: ProReward[]): ProRewardProgress => ({
  approvedRecipes: rewards.some((r) => r.kind === "recipe") ? 1 : 0,
  hasPhotoPost: rewards.some((r) => r.kind === "photo_post"),
});

/** When this user's earned Pro (Pro rewards) runs out: ISO, or null if
 *  they've never earned any. Set only by the database. */
export async function getEarnedProUntil(userId: string): Promise<string | null> {
  const { data, error } = await supabase.from("users").select("pro_reward_until").eq("id", userId).single();
  if (error) throw error;
  return data.pro_reward_until;
}

/** The sheet's own show/dismiss record (users.earn_pro_prompt). */
export type EarnProPrompt = { lastShownDay: string | null; dismissals: number };

export async function getEarnProPrompt(userId: string): Promise<EarnProPrompt> {
  const { data, error } = await supabase.from("users").select("earn_pro_prompt").eq("id", userId).single();
  if (error) throw error;
  const raw = (data.earn_pro_prompt ?? {}) as Partial<EarnProPrompt>;
  return {
    lastShownDay: typeof raw.lastShownDay === "string" ? raw.lastShownDay : null,
    dismissals: typeof raw.dismissals === "number" ? raw.dismissals : 0,
  };
}

export async function setEarnProPrompt(userId: string, prompt: EarnProPrompt): Promise<void> {
  const { error } = await supabase.from("users").update({ earn_pro_prompt: prompt }).eq("id", userId);
  if (error) throw error;
}
