// Stand-in for lib/supabase.ts when the app's api/ code runs in Node for
// /seed-meal (see hooks.mjs). Same exports, but a service-role client: the
// skill runs on the admin's laptop, writes the same tables Seed Meal does,
// and reads meal_sources, which has no RLS policies at all.
//
// The key is never stored: it's read from SUPABASE_SERVICE_ROLE_KEY if set,
// otherwise fetched once per run with the Supabase CLI (already logged in
// via SUPABASE_ACCESS_TOKEN in .env).
import { execFileSync } from "node:child_process";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "../../../../lib/database.types";

function serviceRoleKey(): string {
  if (process.env.SUPABASE_SERVICE_ROLE_KEY) return process.env.SUPABASE_SERVICE_ROLE_KEY;
  const ref = process.env.SUPABASE_PROJECT_REF;
  if (!ref) throw new Error("SUPABASE_PROJECT_REF missing from .env");
  const out = execFileSync("supabase", ["projects", "api-keys", "--project-ref", ref, "-o", "json"], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
  const keys = JSON.parse(out) as { name?: string; api_key?: string }[];
  const key = keys.find((k) => k.name === "service_role")?.api_key;
  if (!key) throw new Error("No service_role key returned by the Supabase CLI");
  return key;
}

const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
if (!url) throw new Error("EXPO_PUBLIC_SUPABASE_URL missing (run with --env-file=.env)");

export const supabase = createClient<Database>(url, serviceRoleKey(), {
  auth: { persistSession: false, autoRefreshToken: false },
});

// Same contract as lib/supabase.ts's invokeEdgeFunction: surface the
// function's own { error } message instead of the generic non-2xx one.
export async function invokeEdgeFunction<T>(name: string, body: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke<T>(name, { body });
  if (error) {
    const context = (error as { context?: Response }).context;
    let detail: string | null = null;
    if (context && typeof context.json === "function") {
      try {
        const parsed = await context.clone().json();
        if (parsed?.error) detail = parsed.error;
        else if (parsed?.message) detail = `${context.status} ${parsed.message}`;
      } catch {
        // not JSON, fall back below
      }
    }
    throw new Error(detail ?? error.message);
  }
  if (!data) throw new Error(`${name} returned no data`);
  return data;
}
