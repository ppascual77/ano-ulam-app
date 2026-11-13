import * as AppleAuthentication from "expo-apple-authentication";
import * as WebBrowser from "expo-web-browser";
import { makeRedirectUri } from "expo-auth-session";
import { ImageManipulator, SaveFormat } from "expo-image-manipulator";

import { invokeEdgeFunction, supabase } from "@/lib/supabase";
import { readImageForUpload } from "@/lib/imageUpload";
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

/** `onApproved` fires once the provider's sheet says yes, before the
 *  session is set up (the app shows its "signing you in" screen then). */
export async function signInWithGoogle(onApproved?: () => void) {
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

  onApproved?.();
  return createSessionFromUrl(result.url);
}

// Native Apple sheet, no browser: Apple hands back an identity token that
// Supabase verifies (https://supabase.com/docs/guides/auth/social-login/auth-apple).
// Returns null when the user cancels, like signInWithGoogle.
export async function signInWithApple(onApproved?: () => void) {
  let credential: AppleAuthentication.AppleAuthenticationCredential;
  try {
    credential = await AppleAuthentication.signInAsync({
      requestedScopes: [
        AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
        AppleAuthentication.AppleAuthenticationScope.EMAIL,
      ],
    });
  } catch (err) {
    if ((err as { code?: string }).code === "ERR_REQUEST_CANCELED") return null;
    throw err;
  }
  if (!credential.identityToken) throw new Error("Apple sign-in returned no identity token");

  onApproved?.();
  const { data, error } = await supabase.auth.signInWithIdToken({ provider: "apple", token: credential.identityToken });
  if (error) throw error;

  // Apple sends the name only on the very first sign-in (and never a photo),
  // so keep it now: on the account, and on the profile row the new-user
  // trigger created without one.
  const fullName = credential.fullName
    ? AppleAuthentication.formatFullName(credential.fullName).trim()
    : "";
  if (fullName && data.user) {
    await supabase.auth.updateUser({ data: { full_name: fullName } });
    await supabase.from("users").update({ display_name: fullName }).eq("id", data.user.id).is("display_name", null);
  }
  return data.session;
}

export type SignInProvider = "google" | "apple";

export function signIn(provider: SignInProvider, onApproved?: () => void) {
  return provider === "apple" ? signInWithApple(onApproved) : signInWithGoogle(onApproved);
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

// ---- profile photo ---------------------------------------------------------

// Profile photos share the post-images bucket (public read; each user writes
// only under their own `<user id>/` folder). They sit at the top of that
// folder, not in a subfolder, so delete-account's top-level sweep removes
// them with the user's post photos.
const AVATAR_BUCKET = "post-images";
const AVATAR_SIZE = 512;

// The bucket path of a profile photo we host, or null for anything else
// (a Google photo, no photo).
function ownAvatarPath(url: string | null | undefined, userId: string): string | null {
  if (!url) return null;
  const marker = `/storage/v1/object/public/${AVATAR_BUCKET}/`;
  const at = url.indexOf(marker);
  if (at === -1) return null;
  const path = decodeURIComponent(url.slice(at + marker.length).split("?")[0]);
  return path.startsWith(`${userId}/avatar-`) ? path : null;
}

// Best effort: a leftover old photo isn't worth failing the change.
async function removeOwnAvatarFile(url: string | null | undefined, userId: string) {
  const path = ownAvatarPath(url, userId);
  if (!path) return;
  try {
    await supabase.storage.from(AVATAR_BUCKET).remove([path]);
  } catch {
    // keep going
  }
}

/** A picked photo: expo-image-picker's local uri and its pixel size. */
export type PickedPhoto = { uri: string; width: number; height: number };

// Center-crops the photo to a square, shrinks it to 512 px, uploads it as
// a JPEG, points users.avatar_url at it, then removes the previous one.
export async function uploadAvatar(
  userId: string,
  photo: PickedPhoto,
  previousUrl: string | null,
): Promise<UserProfile> {
  const side = Math.min(photo.width, photo.height);
  const context = ImageManipulator.manipulate(photo.uri);
  if (side > 0 && photo.width !== photo.height) {
    context.crop({
      originX: Math.floor((photo.width - side) / 2),
      originY: Math.floor((photo.height - side) / 2),
      width: side,
      height: side,
    });
  }
  if (side === 0 || side > AVATAR_SIZE) context.resize({ width: AVATAR_SIZE, height: AVATAR_SIZE });
  const image = await context.renderAsync();
  const saved = await image.saveAsync({ format: SaveFormat.JPEG, compress: 0.8 });

  const { body, contentType } = await readImageForUpload(saved.uri);
  const path = `${userId}/avatar-${Date.now()}.jpg`;
  const { error } = await supabase.storage.from(AVATAR_BUCKET).upload(path, body, { contentType });
  if (error) throw error;
  const url = supabase.storage.from(AVATAR_BUCKET).getPublicUrl(path).data.publicUrl;

  let row: UserProfile;
  try {
    row = await updateUserProfile(userId, { avatar_url: url });
  } catch (e) {
    await removeOwnAvatarFile(url, userId);
    throw e;
  }
  if (previousUrl !== url) await removeOwnAvatarFile(previousUrl, userId);
  return row;
}

// Back to initials: clears users.avatar_url and removes the photo if we host
// it (a Google photo is only unlinked).
export async function removeAvatar(userId: string, previousUrl: string | null): Promise<UserProfile> {
  const row = await updateUserProfile(userId, { avatar_url: null });
  await removeOwnAvatarFile(previousUrl, userId);
  return row;
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
