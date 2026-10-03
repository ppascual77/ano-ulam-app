import type { MealType } from "@/frontend/core/meals/mealTypes";

// MOCK — Discover's like/save calls, with the same names and shapes as the
// web app's frontend/src/api/mealService.ts. There's no like/save backend
// in this app yet, so state lives in memory (resets on reload). When the
// real endpoints exist, replace these function bodies; callers (the
// useDiscoverFeed hook) don't change. Meals themselves are NOT mocked: the
// reel uses the real seeded meals.

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// Mirrors the web app's cap on saved meals.
export const SAVED_MEALS_LIMIT = 15;

type LikeState = { liked: boolean; like_count: number };

const likes = new Map<string, LikeState>();
const saved = new Map<string, string>(); // meal id -> saved id
let nextSavedId = 1;

// The in-memory "server" starts from whatever the real meal row says, so a
// first toggle flips the meal's actual like_count rather than 0.
export function seedMealLike(meal: MealType) {
  if (meal.id && !likes.has(meal.id)) {
    likes.set(meal.id, { liked: meal.liked_by_me ?? false, like_count: meal.like_count ?? 0 });
  }
}

export async function toggleMealLike(mealId: string): Promise<LikeState> {
  await delay(400);
  // Fails ~10% of the time in dev, so the optimistic-update revert path
  // actually gets exercised.
  if (__DEV__ && Math.random() < 0.1) throw new Error("Mock like failed");
  const current = likes.get(mealId) ?? { liked: false, like_count: 0 };
  const next = {
    liked: !current.liked,
    like_count: Math.max(0, current.like_count + (current.liked ? -1 : 1)),
  };
  likes.set(mealId, next);
  return next;
}

export async function saveMeal(meal: MealType): Promise<{ savedId: string }> {
  await delay(400);
  const savedId = `saved-${nextSavedId++}`;
  if (meal.id) saved.set(meal.id, savedId);
  return { savedId };
}

export async function unsaveMeal(savedId: string): Promise<void> {
  await delay(400);
  for (const [mealId, id] of saved) {
    if (id === savedId) saved.delete(mealId);
  }
}
