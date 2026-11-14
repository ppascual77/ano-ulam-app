import { PostHog } from "posthog-react-native";
import { useAuthStore } from "@/frontend/features/auth/store/useAuthStore";
import { useProStore } from "@/frontend/core/pro/store/useProStore";

// Product analytics (PostHog): the events in docs/analytics.md, nothing
// else. No screen, tap or session recording, no personal data: events are
// tied to the Supabase user id (a random id for guests), and every one
// carries whether the person is Pro and how old their account is.
//
// Off without EXPO_PUBLIC_POSTHOG_KEY, and in development (so testing
// doesn't skew the numbers) unless EXPO_PUBLIC_POSTHOG_IN_DEV=1.
const KEY = process.env.EXPO_PUBLIC_POSTHOG_KEY;
const HOST = process.env.EXPO_PUBLIC_POSTHOG_HOST ?? "https://us.i.posthog.com";
const ENABLED = !!KEY && (!__DEV__ || process.env.EXPO_PUBLIC_POSTHOG_IN_DEV === "1");

let client: PostHog | null = null;
function posthog(): PostHog | null {
  if (!ENABLED) return null;
  if (!client) {
    try {
      client = new PostHog(KEY!, {
        host: HOST,
        captureAppLifecycleEvents: false, // app_opened is ours
        enableSessionReplay: false,
        personProfiles: "identified_only",
        disableGeoip: true,
      });
    } catch {
      return null; // never let analytics break the app
    }
  }
  return client;
}

export type ProSource =
  | "results_wall"
  | "limit_sheet"
  | "saved_limit"
  | "settings"
  | "locked_day"
  | "macro_goal"
  | "micros"
  | "feature"
  | "other";

type Events = {
  pro_wall_shown: { screen: "browse" | "mood" | "budget" | "pantry" | "see_all"; hidden_count: number };
  limit_sheet_shown: { kind: "search" | "budget" | "pantry" | "saved_meals" };
  pro_page_opened: { source: ProSource };
  trial_started: { plan: string; source: ProSource };
  purchase_completed: { plan: string; source: ProSource };
  app_opened: Record<string, never>;
  push_permission: { state: "quiet" | "granted" | "denied"; source: "sign_in" | "recipe_submitted" | "settings" };
  push_opened: { type: string };
};

function accountAgeDays(): number | null {
  const created = useAuthStore.getState().session?.user.created_at;
  if (!created) return null;
  return Math.floor((Date.now() - new Date(created).getTime()) / 86_400_000);
}

export function track<E extends keyof Events>(event: E, properties: Events[E]) {
  const ph = posthog();
  if (!ph) return;
  try {
    ph.capture(event, {
      ...properties,
      is_pro: useProStore.getState().isPro,
      signed_in: !!useAuthStore.getState().session,
      account_age_days: accountAgeDays(),
    });
  } catch {
    // Analytics must never break the app.
  }
}

// The Pro page's latest source, so a purchase made from it is credited there.
let lastProSource: ProSource = "other";
export function trackProPageOpened(source: ProSource) {
  lastProSource = source;
  track("pro_page_opened", { source });
}
export const proSourceForPurchase = () => lastProSource;

/** Sign-in (root layout): events from here on belong to this account. */
export function identifyUser(userId: string) {
  try {
    posthog()?.identify(userId);
  } catch {
    // ignore
  }
}

/** Sign-out: a fresh anonymous id, so the next person isn't joined to this account. */
export function resetUser() {
  try {
    posthog()?.reset();
  } catch {
    // ignore
  }
}
