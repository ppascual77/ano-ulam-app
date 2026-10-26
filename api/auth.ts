import * as WebBrowser from "expo-web-browser";
import { makeRedirectUri } from "expo-auth-session";

import { invokeEdgeFunction, supabase } from "@/lib/supabase";
import type { Database } from "@/lib/database.types";

export type UserProfile = Database["public"]["Tables"]["users"]["Row"];

/** Pro: an ingredient the user never wants in suggestions. The names travel
 *  with the id so meals that only list ingredient names can be matched. */
export type AvoidedIngredient = { id: string; name: string; aliases: string[] };

/** Pro: daily targets. null = not set. */
export type NutritionGoals = { calories: number | null; protein: number | null; carbs: number | null; fat: number | null };

export type PlannerSlot = "breakfast" | "lunch" | "dinner" | "merienda";

/** Pro: what the Meal Planner starts from. */
export type PlannerDefaults = {
  weekly_budget: number | null;
  people: number;
  slots: PlannerSlot[];
  days: 5 | 7;
  /** Have next week's plan ready when the planner is opened on/after Sunday. */
  auto_plan: boolean;
};

/** Pro: price drops to be told about. */
export type PriceAlerts = {
  enabled: boolean;
  ingredients: { id: string; name: string }[];
  /** "any": any drop; "10pct": only drops of 10% or more. */
  threshold: "any" | "10pct";
};

// Pro settings (avoid_ingredients onwards) are saved now but not acted on
// anywhere yet: the features that use them come later.
export type UserPreferences = {
  dietary_focus: string;
  allergens: string[];
  goals: string[];
  avoid_ingredients: AvoidedIngredient[];
  nutrition_goals: NutritionGoals;
  planner_defaults: PlannerDefaults;
  price_alerts: PriceAlerts;
};

export const DEFAULT_NUTRITION_GOALS: NutritionGoals = { calories: null, protein: null, carbs: null, fat: null };
export const DEFAULT_PLANNER_DEFAULTS: PlannerDefaults = {
  weekly_budget: null,
  people: 1,
  slots: ["breakfast", "lunch", "dinner"],
  days: 5,
  auto_plan: false,
};
export const DEFAULT_PRICE_ALERTS: PriceAlerts = { enabled: true, ingredients: [], threshold: "any" };

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
const PLANNER_SLOTS: PlannerSlot[] = ["breakfast", "lunch", "dinner", "merienda"];

function parseNutritionGoals(v: unknown): NutritionGoals {
  const o = record(v);
  if (!o) return DEFAULT_NUTRITION_GOALS;
  return { calories: positive(o.calories), protein: positive(o.protein), carbs: positive(o.carbs), fat: positive(o.fat) };
}

function parsePlannerDefaults(v: unknown): PlannerDefaults {
  const o = record(v);
  if (!o) return DEFAULT_PLANNER_DEFAULTS;
  const slots = strings(o.slots).filter((x): x is PlannerSlot => (PLANNER_SLOTS as string[]).includes(x));
  return {
    weekly_budget: positive(o.weekly_budget),
    people: positive(o.people) ?? DEFAULT_PLANNER_DEFAULTS.people,
    slots: slots.length > 0 ? slots : DEFAULT_PLANNER_DEFAULTS.slots,
    days: o.days === 7 ? 7 : 5,
    auto_plan: o.auto_plan === true,
  };
}

function parsePriceAlerts(v: unknown): PriceAlerts {
  const o = record(v);
  if (!o) return DEFAULT_PRICE_ALERTS;
  const ingredients = Array.isArray(o.ingredients)
    ? o.ingredients.flatMap((item) => {
        const i = record(item);
        return i && typeof i.id === "string" && typeof i.name === "string" ? [{ id: i.id, name: i.name }] : [];
      })
    : [];
  return { enabled: o.enabled !== false, ingredients, threshold: o.threshold === "10pct" ? "10pct" : "any" };
}

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
