import * as WebBrowser from "expo-web-browser";
import { makeRedirectUri } from "expo-auth-session";
import * as QueryParams from "expo-auth-session/build/QueryParams";

import { invokeEdgeFunction, supabase } from "@/lib/supabase";
import type { Database } from "@/lib/database.types";

export type UserProfile = Database["public"]["Tables"]["users"]["Row"];

/** An ingredient a Pro user never wants in suggestions. The names travel
 *  with the id so meals that only have ingredient names (mock data) can be
 *  matched too. */
export type AvoidedIngredient = { id: string; name: string; aliases: string[] };

export type UserPreferences = {
  dietary_focus: string;
  allergens: string[];
  goals: string[];
  /** Pro: ingredients to avoid (see useAvoidFilter). */
  avoid_ingredients: AvoidedIngredient[];
};

const DEFAULT_PREFERENCES: UserPreferences = { dietary_focus: "none", allergens: [], goals: [], avoid_ingredients: [] };

const strings = (v: unknown) => (Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : []);

function parseAvoided(v: unknown): AvoidedIngredient[] {
  if (!Array.isArray(v)) return [];
  return v.flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const o = item as Record<string, unknown>;
    return typeof o.id === "string" && typeof o.name === "string" ? [{ id: o.id, name: o.name, aliases: strings(o.aliases) }] : [];
  });
}

// preferences is a jsonb column (typed as Json, not a known shape) — this
// parses it defensively rather than casting, since a malformed/legacy row
// shouldn't crash the UI.
export function parseUserPreferences(
  preferences: UserProfile["preferences"] | undefined,
): UserPreferences {
  if (!preferences || typeof preferences !== "object" || Array.isArray(preferences)) {
    return DEFAULT_PREFERENCES;
  }
  const p = preferences as Record<string, unknown>;
  return {
    dietary_focus: typeof p.dietary_focus === "string" ? p.dietary_focus : DEFAULT_PREFERENCES.dietary_focus,
    allergens: Array.isArray(p.allergens)
      ? p.allergens.filter((v): v is string => typeof v === "string")
      : DEFAULT_PREFERENCES.allergens,
    goals: Array.isArray(p.goals)
      ? p.goals.filter((v): v is string => typeof v === "string")
      : DEFAULT_PREFERENCES.goals,
    avoid_ingredients: parseAvoided(p.avoid_ingredients),
  };
}

// https://supabase.com/docs/guides/auth/native-mobile-deep-linking
async function createSessionFromUrl(url: string) {
  const { params, errorCode } = QueryParams.getQueryParams(url);
  if (errorCode) throw new Error(errorCode);

  const { access_token, refresh_token } = params;
  if (!access_token || !refresh_token) return null;

  const { data, error } = await supabase.auth.setSession({ access_token, refresh_token });
  if (error) throw error;
  return data.session;
}

export async function signInWithGoogle() {
  const redirectTo = makeRedirectUri();
  console.log("[auth debug] redirectTo:", redirectTo);

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo, skipBrowserRedirect: true },
  });
  if (error) throw error;
  console.log("[auth debug] authorize url:", data.url);

  const result = await WebBrowser.openAuthSessionAsync(data.url ?? "", redirectTo);
  console.log("[auth debug] browser result:", result);
  if (result.type !== "success") return null;

  return createSessionFromUrl(result.url);
}

export async function signOut() {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}

// Permanently deletes the signed-in user's account and their recipes (see
// supabase/functions/delete-account), then clears the now-dead session on
// this device.
export async function deleteAccount() {
  await invokeEdgeFunction<{ deleted: boolean }>("delete-account", {});
  await supabase.auth.signOut({ scope: "local" });
}

export async function getUserProfile(userId: string) {
  const { data, error } = await supabase.from("users").select("*").eq("id", userId).single();
  if (error) throw error;
  return data;
}

export async function updateUserProfile(userId: string, patch: Partial<UserProfile>) {
  const { data, error } = await supabase
    .from("users")
    .update(patch)
    .eq("id", userId)
    .select()
    .single();
  if (error) throw error;
  return data;
}
