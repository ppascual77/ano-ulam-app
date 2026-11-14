// Gate for the admin-only edge functions (the AI, USDA and DA tools behind
// the admin screens). They spend the OpenAI/USDA quota, so the anon key that
// ships in the app mustn't be enough to call them.
//
// Let through:
// - an admin: a signed-in user whose app_metadata.role is "admin" (set
//   server-side; users can't edit it), same rule as public.is_admin();
// - the service role: the /seed-meal skill calls these with the legacy
//   service_role key. That isn't always the same string as this function's
//   SUPABASE_SERVICE_ROLE_KEY, so a token that claims the service role is
//   verified by Supabase itself (an Auth admin call only a real, signed
//   service key can make), never trusted from its decoded claim alone: that
//   claim is only safe while the gateway checks signatures (verify_jwt), and
//   a function deployed with --no-verify-jwt would take a forged one.
// Everyone else gets 401 (no session) or 403 (signed in, not an admin).
//
// Usage, first thing in a handler (after any method check):
//   const denied = await requireAdmin(req);
//   if (denied) return denied;

import { createClient } from "npm:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

function deny(status: number, error: string): Response {
  return new Response(JSON.stringify({ error }), { status, headers: { "Content-Type": "application/json" } });
}

// The role a JWT claims. Unverified: only a hint for which check to run.
function claimedRole(token: string): string | null {
  try {
    const payload = token.split(".")[1];
    if (!payload) return null;
    const json = atob(payload.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(payload.length / 4) * 4, "="));
    return (JSON.parse(json) as { role?: string }).role ?? null;
  } catch {
    return null;
  }
}

// Supabase Auth only answers an admin call for a genuine service key.
async function isRealServiceKey(token: string): Promise<boolean> {
  const client = createClient(SUPABASE_URL, token, { auth: { persistSession: false, autoRefreshToken: false } });
  const { error } = await client.auth.admin.listUsers({ page: 1, perPage: 1 });
  return !error;
}

export async function requireAdmin(req: Request): Promise<Response | null> {
  const token = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "").trim();
  if (!token) return deny(401, "Sign in required");

  if (SUPABASE_SERVICE_ROLE_KEY && token === SUPABASE_SERVICE_ROLE_KEY) return null;
  if (claimedRole(token) === "service_role") {
    return (await isRealServiceKey(token)) ? null : deny(401, "Sign in required");
  }

  // The anon key is a valid JWT too, but has no user behind it.
  const client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { auth: { persistSession: false } });
  const { data, error } = await client.auth.getUser(token);
  if (error || !data.user) return deny(401, "Sign in required");
  if (data.user.app_metadata?.role !== "admin") return deny(403, "Admins only");
  return null;
}
