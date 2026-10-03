// MOCK — profile data with no backend yet (bio, saved meal plan), under the
// spec'd function names so wiring the real users / fitness_profile rows
// later is a swap of these bodies. In memory, resets on reload. Name and
// avatar are NOT mocked: they come from the real session.

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export const BIO_LIMIT = 50;

export type SavedMealPlan = {
  inputs: { goal?: "lose" | "maintain" | "gain"; activity?: "sedentary" | "light" | "moderate" | "active" };
  targets: { calories: number; protein: number; carbs: number; fats: number };
};

export type ProfileExtras = {
  bio: string | null;
  savedMealPlan: SavedMealPlan | null;
};

let extras: ProfileExtras = {
  bio: null,
  // Seeded so the Meal Plan banner shows (the planner can't save one yet).
  savedMealPlan: {
    inputs: { goal: "lose", activity: "moderate" },
    targets: { calories: 1850, protein: 140, carbs: 180, fats: 60 },
  },
};

export async function getProfileExtras(): Promise<ProfileExtras> {
  await delay(300);
  return { ...extras };
}

export async function updateBio(bio: string): Promise<void> {
  await delay(400);
  extras = { ...extras, bio: bio || null };
}

// Grocery checkboxes, by item id, holding the quantity the item had when it
// was checked: if the quantity changes later (e.g. a servings update), the
// item reads as unchecked so the user knows to restock.
let groceryChecks: Record<string, string> = {};

export async function getGroceryChecks(): Promise<Record<string, string>> {
  await delay(200);
  return { ...groceryChecks };
}

// One batch of changes: item id -> its quantity (checked) or null (unchecked).
export async function flushGroceryChecks(changes: Record<string, string | null>): Promise<void> {
  await delay(300);
  const next = { ...groceryChecks };
  for (const [id, qty] of Object.entries(changes)) {
    if (qty === null) delete next[id];
    else next[id] = qty;
  }
  groceryChecks = next;
}
