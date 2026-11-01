import { supabase } from "@/lib/supabase";
import type { Database } from "@/lib/database.types";
import type { SavedMealRow } from "./saved";

// Other users' profiles. `users` and `saved_meals` stay owner-only (RLS);
// these go through two narrow database functions that return only what a
// profile page shows (signed-in users only).

export type PublicProfileRow = Database["public"]["Functions"]["get_public_profile"]["Returns"][number];

/** null when there's no such user. */
export async function getPublicProfile(userId: string): Promise<PublicProfileRow | null> {
  const { data, error } = await supabase.rpc("get_public_profile", { p_user_id: userId });
  if (error) throw error;
  return data[0] ?? null;
}

/** Their saved meals, most recent first; empty unless they made them
 *  public. */
export async function listPublicSavedMealRows(userId: string): Promise<SavedMealRow[]> {
  const { data, error } = await supabase.rpc("get_public_saved_meals", { p_user_id: userId });
  if (error) throw error;
  return data;
}
