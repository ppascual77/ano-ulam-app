// Gate for edge functions any signed-in user may call (e.g. the Klipy GIF
// search behind the Community post sheet). The anon key that ships in the
// app is a valid JWT but has no user behind it, so it's refused here.
//
// Usage, first thing in a handler (after any method check):
//   const denied = await requireUser(req);
//   if (denied) return denied;

import { createClient } from "npm:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

export async function requireUser(req: Request): Promise<Response | null> {
  const token = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "").trim();
  const deny = () =>
    new Response(JSON.stringify({ error: "Sign in required" }), { status: 401, headers: { "Content-Type": "application/json" } });
  if (!token) return deny();
  const client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { auth: { persistSession: false } });
  const { data, error } = await client.auth.getUser(token);
  return error || !data.user ? deny() : null;
}
