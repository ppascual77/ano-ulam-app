import { supabase } from "@/lib/supabase";

// The signed-in user's daily limits (public.daily_usage), counted per
// account by the database: a Philippine day, limits by tier (none for
// Pro). Guests have no account; their count stays on the phone
// (frontend/core/pro/dailyLimits.ts).

export type LimitKind = "search" | "budget" | "pantry";

/** The last counted use's signature (the latest day's), for the app's
 *  "only refines the last one" check. */
export async function getLastUse(kind: LimitKind): Promise<string | null> {
  const { data, error } = await supabase
    .from("daily_usage")
    .select("last")
    .eq("kind", kind)
    .order("day", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data?.last ?? null;
}

/** Counts one use. `refines`: the app says it only refines the last one
 *  (free). left is null when the account has no limit. */
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
