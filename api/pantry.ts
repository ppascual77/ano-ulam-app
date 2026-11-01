import { supabase } from "@/lib/supabase";

// The signed-in user's pantry (public.pantry_items, owner-only RLS): one row
// per ingredient they have at home, its name from the ingredients table.

export type PantryRow = { id: string; name: string };

async function currentUserId() {
  const { data } = await supabase.auth.getSession();
  const id = data.session?.user.id;
  if (!id) throw new Error("Not signed in");
  return id;
}

// Oldest first, so the pantry keeps the order things were added in.
export async function listPantry(): Promise<PantryRow[]> {
  const { data, error } = await supabase
    .from("pantry_items")
    .select("ingredient_id, ingredients(canonical_name)")
    .order("added_at", { ascending: true });
  if (error) throw error;
  return data.flatMap((row) => (row.ingredients ? [{ id: row.ingredient_id, name: row.ingredients.canonical_name }] : []));
}

/** Adds these ingredients (ones already there are left as they are). */
export async function addToPantry(ingredientIds: string[]): Promise<void> {
  if (ingredientIds.length === 0) return;
  const userId = await currentUserId();
  const { error } = await supabase
    .from("pantry_items")
    .upsert(
      ingredientIds.map((ingredient_id) => ({ user_id: userId, ingredient_id })),
      { onConflict: "user_id,ingredient_id", ignoreDuplicates: true },
    );
  if (error) throw error;
}

/** Makes the pantry exactly these ingredients: adds what's new, removes
 *  what's gone, and leaves the rest (and when they were added) alone. */
export async function savePantry(ingredientIds: string[]): Promise<void> {
  const { data, error } = await supabase.from("pantry_items").select("ingredient_id");
  if (error) throw error;
  const current = new Set(data.map((row) => row.ingredient_id));
  const wanted = new Set(ingredientIds);
  const removed = [...current].filter((id) => !wanted.has(id));
  if (removed.length > 0) {
    const { error: deleteError } = await supabase.from("pantry_items").delete().in("ingredient_id", removed);
    if (deleteError) throw deleteError;
  }
  await addToPantry([...wanted].filter((id) => !current.has(id)));
}
