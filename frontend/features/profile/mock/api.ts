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
