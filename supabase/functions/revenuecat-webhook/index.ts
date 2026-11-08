// RevenueCat → the database: keeps users.pro_until in step with the App
// Store subscription, so the database's own Pro checks (is_pro: the
// saved-meals cap, daily limits) agree with the app. Called by RevenueCat on
// every subscription event (purchase, renewal, cancel, expiry, billing
// issue, transfer), sandbox and production alike.
//
// Not trusting the event's own dates: for every account the event touches,
// it asks RevenueCat for the current `anoulam_pro` entitlement and writes
// its end. That's correct whatever order events arrive in, and covers
// transfers (Pro moving between accounts on Restore) too.
//
// Secrets (supabase secrets set ...):
// - REVENUECAT_WEBHOOK_AUTH: the Authorization header value set on the
//   webhook in RevenueCat; anything else is turned away.
// - REVENUECAT_SECRET_API_KEY: a RevenueCat secret API key (v1, "sk_..."),
//   to read subscribers.
// Deployed with --no-verify-jwt (RevenueCat has no Supabase JWT).

import { createClient } from "npm:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const WEBHOOK_AUTH = Deno.env.get("REVENUECAT_WEBHOOK_AUTH");
const REVENUECAT_SECRET_API_KEY = Deno.env.get("REVENUECAT_SECRET_API_KEY");

/** The entitlement both plans unlock (same as the app's useProStore). */
const ENTITLEMENT = "anoulam_pro";
// App user ids are Supabase user ids once signed in; anonymous RevenueCat
// ids ($RCAnonymousID:...) have no users row and are skipped.
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

type RevenueCatEvent = {
  type?: string;
  app_user_id?: string;
  original_app_user_id?: string;
  aliases?: string[];
  transferred_from?: string[];
  transferred_to?: string[];
};

// The account's Pro end right now: the entitlement's expiry (past or
// future), or null if it never had Pro.
async function proUntil(appUserId: string): Promise<string | null> {
  const res = await fetch(`https://api.revenuecat.com/v1/subscribers/${encodeURIComponent(appUserId)}`, {
    headers: { Authorization: `Bearer ${REVENUECAT_SECRET_API_KEY}` },
  });
  if (!res.ok) throw new Error(`RevenueCat ${res.status} for ${appUserId}`);
  const body = await res.json();
  const entitlement = body?.subscriber?.entitlements?.[ENTITLEMENT];
  if (!entitlement) return null;
  // null expires_date would be lifetime access (not sold): far future.
  return entitlement.expires_date ?? "9999-12-31T00:00:00Z";
}

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") return json({ error: "POST only" }, 405);
  if (!WEBHOOK_AUTH || !REVENUECAT_SECRET_API_KEY) return json({ error: "Not configured" }, 500);

  const auth = req.headers.get("Authorization") ?? "";
  if (auth !== WEBHOOK_AUTH && auth !== `Bearer ${WEBHOOK_AUTH}`) return json({ error: "Unauthorized" }, 401);

  let event: RevenueCatEvent;
  try {
    event = ((await req.json()) as { event?: RevenueCatEvent }).event ?? {};
  } catch {
    return json({ error: "Bad body" }, 400);
  }
  // RevenueCat's "Send test event" button.
  if (event.type === "TEST") return json({ ok: true, test: true });

  const ids = [
    ...new Set(
      [event.app_user_id, event.original_app_user_id, ...(event.aliases ?? []), ...(event.transferred_from ?? []), ...(event.transferred_to ?? [])]
        .filter((id): id is string => !!id && UUID.test(id)),
    ),
  ];

  const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
  try {
    const updated: Record<string, string | null> = {};
    for (const id of ids) {
      const until = await proUntil(id);
      const { error } = await admin.from("users").update({ pro_until: until }).eq("id", id);
      if (error) throw error;
      updated[id] = until;
    }
    return json({ ok: true, type: event.type, updated });
  } catch (error) {
    // A non-2xx makes RevenueCat retry later.
    return json({ error: error instanceof Error ? error.message : String(error) }, 500);
  }
});
