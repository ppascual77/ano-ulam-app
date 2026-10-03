// Deletes the signed-in user's account: the in-app "Delete account" that
// App Store review requires. Needs the service-role key (deleting an auth
// user is an admin call), which is why this is an edge function and not an
// api/*.ts query.
//
// Only ever deletes the caller: the user id comes from their own JWT, never
// from the request body.
//
// Their recipes are deleted too (photos best-effort). meals.poster_id is
// "on delete set null", and a null poster means an official AnoUlam meal,
// so leaving them would re-label a deleted user's recipes as AnoUlam's.
// Anyone who saved one sees it as "Removed by creator". The public.users
// row goes with the auth user (on delete cascade).

import { createClient } from "npm:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") return json({ error: "POST only" }, 405);

  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return json({ error: "Not signed in" }, 401);

  // Who's asking: resolved from their own token.
  const asUser = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: userData, error: userError } = await asUser.auth.getUser();
  if (userError || !userData.user) return json({ error: "Not signed in" }, 401);
  const userId = userData.user.id;

  const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  try {
    const { data: meals, error: mealsError } = await admin.from("meals").select("id").eq("poster_id", userId);
    if (mealsError) throw mealsError;

    for (const { id } of meals ?? []) {
      try {
        const { data: files } = await admin.storage.from("meal-images").list(id);
        if (files && files.length > 0) {
          await admin.storage.from("meal-images").remove(files.map((f) => `${id}/${f.name}`));
        }
      } catch {
        // An orphaned photo is harmless; don't block the account deletion.
      }
    }

    if (meals && meals.length > 0) {
      const { error } = await admin.from("meals").delete().eq("poster_id", userId);
      if (error) throw error;
    }

    const { error: deleteError } = await admin.auth.admin.deleteUser(userId);
    if (deleteError) throw deleteError;

    return json({ deleted: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Couldn't delete the account";
    return json({ error: message }, 500);
  }
});
