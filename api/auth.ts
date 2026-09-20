import * as WebBrowser from "expo-web-browser";
import { makeRedirectUri } from "expo-auth-session";
import * as QueryParams from "expo-auth-session/build/QueryParams";

import { supabase } from "@/lib/supabase";
import type { Database } from "@/lib/database.types";

export type UserProfile = Database["public"]["Tables"]["users"]["Row"];

export type UserPreferences = {
  dietary_focus: string;
  allergens: string[];
  goals: string[];
};

const DEFAULT_PREFERENCES: UserPreferences = { dietary_focus: "none", allergens: [], goals: [] };

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
