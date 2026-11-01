import * as WebBrowser from "expo-web-browser";
import { makeRedirectUri } from "expo-auth-session";

import { invokeEdgeFunction, supabase } from "@/lib/supabase";
import type { Database } from "@/lib/database.types";

export type UserProfile = Database["public"]["Tables"]["users"]["Row"];

/** Pro: an ingredient the user never wants in suggestions. The names travel
 *  with the id so meals that only list ingredient names can be matched.
 *  `family` set: the whole food (every ingredient whose catalog name starts
 *  with that word, e.g. "chicken"), not just this one. */
export type AvoidedIngredient = { id: string; name: string; aliases: string[]; family?: string };

/** Pro: daily targets. null = not set. */
export type NutritionGoals = {
  calories: number | null;
  protein: number | null;
  carbs: number | null;
  fat: number | null;
  /** What the targets were made for (the guided setup's goal step). */
  goal: "lose" | "build" | "maintain" | null;
};

/** Pro: how many days each new meal plan covers. */
export type PlannerDefaults = { days: 5 | 7 };

/** Pro: the day's biggest price drops, shown in Price Watch. On or off. */
export type PriceAlerts = { enabled: boolean };

// Pro settings (avoid_ingredients onwards), acted on only while Pro:
// avoid_ingredients hides meals (useAvoidFilter), nutrition_goals shows in
// Meal Details and the planner, price_alerts turns on Price Watch's daily
// price drops.
// planner_defaults.days sets how long each new meal plan is.
export type UserPreferences = {
  dietary_focus: string;
  allergens: string[];
  goals: string[];
  avoid_ingredients: AvoidedIngredient[];
  nutrition_goals: NutritionGoals;
  planner_defaults: PlannerDefaults;
  price_alerts: PriceAlerts;
};

export const DEFAULT_NUTRITION_GOALS: NutritionGoals = { calories: null, protein: null, carbs: null, fat: null, goal: null };
export const DEFAULT_PLANNER_DEFAULTS: PlannerDefaults = { days: 5 };
export const DEFAULT_PRICE_ALERTS: PriceAlerts = { enabled: true };

const DEFAULT_PREFERENCES: UserPreferences = {
  dietary_focus: "none",
  allergens: [],
  goals: [],
  avoid_ingredients: [],
  nutrition_goals: DEFAULT_NUTRITION_GOALS,
  planner_defaults: DEFAULT_PLANNER_DEFAULTS,
  price_alerts: DEFAULT_PRICE_ALERTS,
};

const record = (v: unknown): Record<string, unknown> | null =>
  v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : null;
const positive = (v: unknown) => (typeof v === "number" && Number.isFinite(v) && v > 0 ? v : null);

function parseNutritionGoals(v: unknown): NutritionGoals {
  const o = record(v);
  if (!o) return DEFAULT_NUTRITION_GOALS;
  const goal = o.goal === "lose" || o.goal === "build" || o.goal === "maintain" ? o.goal : null;
  return { calories: positive(o.calories), protein: positive(o.protein), carbs: positive(o.carbs), fat: positive(o.fat), goal };
}

function parsePlannerDefaults(v: unknown): PlannerDefaults {
  return { days: record(v)?.days === 7 ? 7 : 5 };
}

function parsePriceAlerts(v: unknown): PriceAlerts {
  const o = record(v);
  return { enabled: o ? o.enabled !== false : DEFAULT_PRICE_ALERTS.enabled };
}

const strings = (v: unknown) => (Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : []);

function parseAvoided(v: unknown): AvoidedIngredient[] {
  if (!Array.isArray(v)) return [];
  return v.flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const o = item as Record<string, unknown>;
    if (typeof o.id !== "string" || typeof o.name !== "string") return [];
    const family = typeof o.family === "string" && o.family ? o.family : undefined;
    return [{ id: o.id, name: o.name, aliases: strings(o.aliases), ...(family ? { family } : {}) }];
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
    nutrition_goals: parseNutritionGoals(p.nutrition_goals),
    planner_defaults: parsePlannerDefaults(p.planner_defaults),
    price_alerts: parsePriceAlerts(p.price_alerts),
  };
}

/** Query + hash params of a redirect URL. Same as expo-auth-session's
 *  getQueryParams, which SDK 58 no longer lets us import. */
function getQueryParams(input: string) {
  const url = new URL(input, "https://phony.example");
  const errorCode = url.searchParams.get("errorCode");
  url.searchParams.delete("errorCode");
  const params: Record<string, string> = {};
  url.searchParams.forEach((value, key) => (params[key] = value));
  if (url.hash) new URLSearchParams(url.hash.replace(/^#/, "")).forEach((value, key) => (params[key] = value));
  return { errorCode, params };
}

// https://supabase.com/docs/guides/auth/native-mobile-deep-linking
async function createSessionFromUrl(url: string) {
  const { params, errorCode } = getQueryParams(url);
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

// The page intros this user has seen (users.seen_intros), so each plays once
// per account. Read and written on its own, never through preferences.
export async function getSeenIntros(userId: string): Promise<string[]> {
  const { data, error } = await supabase.from("users").select("seen_intros").eq("id", userId).single();
  if (error) throw error;
  return data.seen_intros ?? [];
}

export async function setSeenIntros(userId: string, ids: string[]): Promise<void> {
  const { error } = await supabase.from("users").update({ seen_intros: ids }).eq("id", userId);
  if (error) throw error;
}
