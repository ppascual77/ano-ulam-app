import { supabase } from "@/lib/supabase";

/** What a user has done toward Pro rewards (the earning itself needs Pro on
 *  the account, not built yet; see docs/integration-status.md). */
export type ProRewardProgress = {
  /** Their recipes an admin approved. */
  approvedRecipes: number;
  /** Whether they've shared a Food Post with a photo. */
  hasPhotoPost: boolean;
};

export async function getProRewardProgress(userId: string): Promise<ProRewardProgress> {
  const [recipes, posts] = await Promise.all([
    supabase.from("meals").select("id", { count: "exact", head: true }).eq("poster_id", userId).eq("status", "approved"),
    supabase.from("food_posts").select("id").eq("user_id", userId).not("image_url", "is", null).limit(1),
  ]);
  if (recipes.error) throw recipes.error;
  if (posts.error) throw posts.error;
  return { approvedRecipes: recipes.count ?? 0, hasPhotoPost: (posts.data ?? []).length > 0 };
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
