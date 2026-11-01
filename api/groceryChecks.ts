import { supabase } from "@/lib/supabase";

// The signed-in user's grocery checkboxes (public.grocery_checks, owner-only
// RLS), per list: the one built from their saved meals ("saved") or from
// their meal plan ("plan"). Keyed by the item's key
// (its lowercased name: the list is rebuilt from saved meals, so there's no
// row id), holding the quantity it had when checked: if that changes (a
// servings update), the item reads as unchecked again (restock).

async function currentUserId() {
  const { data } = await supabase.auth.getSession();
  const id = data.session?.user.id;
  if (!id) throw new Error("Not signed in");
  return id;
}

export type GroceryListKind = "saved" | "plan";

/** item key -> the quantity it was checked at. */
export async function listGroceryChecks(list: GroceryListKind): Promise<Record<string, string>> {
  const { data, error } = await supabase.from("grocery_checks").select("item_key, qty").eq("list", list);
  if (error) throw error;
  return Object.fromEntries(data.map((row) => [row.item_key, row.qty]));
}

/** One batch of changes: item key -> its quantity (checked) or null
 *  (unchecked). */
export async function applyGroceryChecks(list: GroceryListKind, changes: Record<string, string | null>): Promise<void> {
  const entries = Object.entries(changes);
  const checked = entries.filter((entry): entry is [string, string] => entry[1] !== null);
  const unchecked = entries.filter(([, qty]) => qty === null).map(([key]) => key);

  if (checked.length > 0) {
    const userId = await currentUserId();
    const now = new Date().toISOString();
    const { error } = await supabase
      .from("grocery_checks")
      .upsert(
        checked.map(([item_key, qty]) => ({ user_id: userId, list, item_key, qty, checked_at: now })),
        { onConflict: "user_id,list,item_key" },
      );
    if (error) throw error;
  }
  if (unchecked.length > 0) {
    const { error } = await supabase.from("grocery_checks").delete().eq("list", list).in("item_key", unchecked);
    if (error) throw error;
  }
}

/** Unticks a whole list (a new meal plan starts with a fresh list). */
export async function clearGroceryChecks(list: GroceryListKind): Promise<void> {
  const { error } = await supabase.from("grocery_checks").delete().eq("list", list);
  if (error) throw error;
}
