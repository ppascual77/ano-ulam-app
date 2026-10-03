import { getIngredientsForMatching } from "@/api/meals";

// MOCK — the user's pantry (fitness_profile.pantry_ingredients on the web),
// under the spec'd names so a real table later is a swap of these bodies.
// In memory, resets on reload. The ingredients themselves are real rows
// from the ingredients table (picked through IngredientSearch).

export type PantryIngredient = { id: string; name: string };

// Suggestions unlock at this many ingredients.
export const PANTRY_MIN_FOR_SUGGESTIONS = 3;

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

let pantry: PantryIngredient[] = [];

// TEMP (dev only): start with 2 real ingredients (garlic, egg), so the "add
// 1 more" label and Grocery's "Have" tag show without setup.
const DEV_SEED = __DEV__;
const SEED_NAMES = ["garlic", "egg"];
let seeded = false;

async function seed() {
  if (seeded) return;
  seeded = true;
  if (!DEV_SEED) return;
  try {
    const rows = await getIngredientsForMatching();
    pantry = SEED_NAMES.flatMap((name) => {
      const row = rows.find((r) => r.canonical_name.toLowerCase() === name) ?? rows.find((r) => r.canonical_name.toLowerCase().startsWith(name));
      return row ? [{ id: row.id, name: row.canonical_name }] : [];
    });
  } catch {
    // Start empty if the catalog can't load.
  }
}

export async function getPantry(): Promise<PantryIngredient[]> {
  await seed();
  await delay(300);
  return [...pantry];
}

// Duplicate ids are dropped.
export async function savePantry(items: PantryIngredient[]): Promise<void> {
  await delay(300);
  const seen = new Set<string>();
  pantry = items.filter((item) => !seen.has(item.id) && seen.add(item.id));
}
