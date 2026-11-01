import { supabase } from "@/lib/supabase";

// The signed-in user's meal likes (public.meal_likes, owner-only RLS). Each
// meal's like_count is kept by the database (a trigger on meal_likes), so
// liking is just adding or removing your own row.

async function currentUserId() {
  const { data } = await supabase.auth.getSession();
  const id = data.session?.user.id;
  if (!id) throw new Error("Not signed in");
  return id;
}

/** Every meal id the user has liked. */
export async function listLikedMealIds(): Promise<string[]> {
  const { data, error } = await supabase.from("meal_likes").select("meal_id");
  if (error) throw error;
  return data.map((row) => row.meal_id);
}

export async function likeMeal(mealId: string): Promise<void> {
  const userId = await currentUserId();
  const { error } = await supabase.from("meal_likes").insert({ user_id: userId, meal_id: mealId });
  // Already liked (another device, a double tap): that's the goal anyway.
  if (error && error.code !== "23505") throw error;
}

export async function unlikeMeal(mealId: string): Promise<void> {
  const { error } = await supabase.from("meal_likes").delete().eq("meal_id", mealId);
  if (error) throw error;
}

/** A meal's current like count (after a like or unlike). */
export async function getLikeCount(mealId: string): Promise<number> {
  const { data, error } = await supabase.from("meals").select("like_count").eq("id", mealId).single();
  if (error) throw error;
  return data.like_count;
}
