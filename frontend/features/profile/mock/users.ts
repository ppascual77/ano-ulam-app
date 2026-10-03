import { getMeals } from "@/api/meals";
import { mealRowToMealType } from "@/frontend/core/meals/utils/mealAdapter";
import type { SavedMeal } from "@/frontend/core/saved/types";
import { savedKeyOf } from "@/frontend/core/saved/types";

// MOCK — other users' public profiles. Real names/avatars need a readable
// profile table: `users` only lets you read your own row (RLS), so for now
// these are fixtures keyed to the authors in core/posts/mock/posts.ts.
// Same function names as the spec, so a real query later is a body swap.

export type PublicProfile = {
  id: string;
  display_name: string | null;
  avatar_url: string | null;
  bio: string | null;
  show_saved_public: boolean;
  saved_meals: SavedMeal[];
};

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

type Fixture = Omit<PublicProfile, "saved_meals"> & { savedCount: number };

const FIXTURES: Fixture[] = [
  { id: "u2", display_name: "Ate Lorna", avatar_url: null, bio: "Lutong bahay every Sunday 🍲", show_saved_public: true, savedCount: 4 },
  { id: "u3", display_name: "Migs Cooks", avatar_url: null, bio: "Learning one ulam at a time.", show_saved_public: false, savedCount: 3 },
  { id: "u4", display_name: "Bea Santos", avatar_url: null, bio: null, show_saved_public: true, savedCount: 2 },
  { id: "u5", display_name: "Kuya Jun", avatar_url: null, bio: "Budget meals for the barkada", show_saved_public: true, savedCount: 0 },
  { id: "u6", display_name: "Carlo D.", avatar_url: null, bio: null, show_saved_public: true, savedCount: 1 },
];

// A user's public saved list: real catalog meals, picked per user so each
// profile shows something different.
async function savedFor(fixture: Fixture, offset: number): Promise<SavedMeal[]> {
  if (fixture.savedCount === 0) return [];
  const rows = await getMeals();
  return rows.slice(offset, offset + fixture.savedCount).map((row, i) => {
    const meal = mealRowToMealType(row);
    return {
      ...meal,
      saved_id: `${fixture.id}-saved-${i}`,
      meal_catalog_id: savedKeyOf(meal),
      date_saved: meal.created_at ?? new Date().toISOString(),
      serving_size: meal.serving_size ?? 1,
      catalog_status: "active",
    };
  });
}

// Throws Error("unauthorized") for guests, like the real endpoint. A real
// user id with no fixture (e.g. a community recipe's poster) gets a bare
// profile: no name, bio or public saved meals.
export async function getUserProfile(userId: string, isGuest: boolean): Promise<PublicProfile> {
  await delay(400);
  if (isGuest) throw new Error("unauthorized");
  const index = FIXTURES.findIndex((f) => f.id === userId);
  if (index === -1) {
    return { id: userId, display_name: null, avatar_url: null, bio: null, show_saved_public: false, saved_meals: [] };
  }
  const fixture = FIXTURES[index];
  const { savedCount: _savedCount, ...profile } = fixture;
  return { ...profile, saved_meals: fixture.show_saved_public ? await savedFor(fixture, index * 3) : [] };
}

// The official account's own feed posts. None yet: the Posts tab shows the
// two hardcoded guide posts (OFFICIAL_POSTS) after these.
export async function getOfficialProfile() {
  await delay(300);
  return {
    user: { id: "anoulam", display_name: "AnoUlam", avatar_url: null, bio: "The official AnoUlam account." },
    posts: [],
  };
}
