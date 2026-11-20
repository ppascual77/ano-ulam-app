import { supabase } from "@/lib/supabase";

// The signed-in user's daily limits (public.daily_usage), counted per
// account by the database: a Philippine day, limits by tier (none for
// Pro). Guests have no account; their count stays on the phone
// (frontend/core/pro/dailyLimits.ts).

export type LimitKind = "search" | "budget" | "pantry" | "narration";

/** Counts one use. The database decides repeats and refinements;
 *  `refines` is ignored there (kept for older builds). left is null when
 *  the account has no limit. */
export async function countDailyUse(
  kind: LimitKind,
  signature: string,
  refines: boolean,
): Promise<{ allowed: boolean; left: number | null }> {
  const { data, error } = await supabase.rpc("count_daily_use", { p_kind: kind, p_signature: signature, p_refines: refines });
  if (error) throw error;
  const row = data[0];
  return { allowed: row?.allowed ?? true, left: row?.uses_left ?? null };
}

/** Uses left today (null: no limit). */
export async function getDailyUsesLeft(kind: LimitKind): Promise<number | null> {
  const { data, error } = await supabase.rpc("daily_uses_left", { p_kind: kind });
  if (error) throw error;
  return data;
}
