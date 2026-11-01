import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRealMeals } from "@/frontend/core/meals/hooks/useRealMeals";
import type { MealType } from "@/frontend/core/meals/mealTypes";
import { useSavedMealActions } from "@/frontend/core/saved/hooks/useSavedMeals";

const BATCH_SIZE = 5;
// Start loading the next batch this many meals before the end, so the
// next meal is ready by the time the user swipes to it.
const PREFETCH_DISTANCE = 2;

// Save state is keyed by normalized_name (falling back to name), not id,
// to match the web app's store.
export function mealKey(meal: MealType) {
  return meal.normalized_name ?? meal.name;
}

function shuffle<T>(items: T[]): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

export type FeedStatus = "loading" | "ready" | "error";

// All Recipes-tab state for DiscoverScreen. Meals are the real seeded
// catalog (useRealMeals), shuffled and dealt out in batches: logged-in
// users get the next batch as they near the end, guests get one batch and
// then the end-card. Saves go through the shared saved-meals list
// (core/saved), same as everywhere.
export function useDiscoverFeed({ isGuest }: { isGuest: boolean }) {
  const { data: allMeals, isLoading, isError, refetch } = useRealMeals();

  const [meals, setMeals] = useState<MealType[]>([]);
  const [activeIndex, setActiveIndex] = useState(0);
  const saved = useSavedMealActions();
  const [inFlight, setInFlight] = useState<Record<string, true>>({});

  const pool = useRef<MealType[]>([]);
  const seen = useRef(new Set<string>());
  const loadingMore = useRef(false);

  // Deals the next batch off the shuffled pool, skipping anything already
  // shown (de-duped by meal key across batches).
  const takeBatch = useCallback(() => {
    const batch: MealType[] = [];
    while (pool.current.length > 0 && batch.length < BATCH_SIZE) {
      const meal = pool.current.shift() as MealType;
      const key = mealKey(meal);
      if (seen.current.has(key)) continue;
      seen.current.add(key);
      batch.push(meal);
    }
    return batch;
  }, []);

  // Fresh start: reshuffle and deal the first batch. Used on first load and
  // whenever the user switches back to the Recipes tab.
  const reset = useCallback(() => {
    pool.current = shuffle(allMeals ?? []);
    seen.current = new Set();
    loadingMore.current = false;
    setActiveIndex(0);
    setMeals(takeBatch());
  }, [allMeals, takeBatch]);

  // Deal once the catalog first arrives. Later catalog refreshes (a save
  // changing a count) don't restart the reel under the user.
  const dealt = useRef(false);
  useEffect(() => {
    if (!allMeals || dealt.current) return;
    dealt.current = true;
    reset();
  }, [allMeals, reset]);

  // Infinite feed, logged-in only: guests never prefetch.
  useEffect(() => {
    if (isGuest || loadingMore.current) return;
    if (meals.length === 0 || activeIndex < meals.length - PREFETCH_DISTANCE) return;
    if (pool.current.length === 0) return;
    loadingMore.current = true;
    const batch = takeBatch();
    if (batch.length > 0) setMeals((prev) => [...prev, ...batch]);
    loadingMore.current = false;
  }, [activeIndex, meals.length, isGuest, takeBatch]);

  const setBusy = (key: string, busy: boolean) =>
    setInFlight((prev) => {
      const next = { ...prev };
      if (busy) next[key] = true;
      else delete next[key];
      return next;
    });

  // The reel holds its own copies of the meals; a meal's save count comes
  // from the live catalog so it moves when someone saves it.
  const liveSaveCounts = useMemo(
    () => new Map((allMeals ?? []).map((meal) => [mealKey(meal), meal.save_count ?? 0])),
    [allMeals],
  );
  const saveCountOf = useCallback(
    (meal: MealType) => liveSaveCounts.get(mealKey(meal)) ?? meal.save_count ?? 0,
    [liveSaveCounts],
  );

  // Returns an error message for the caller to toast (the saved meals limit),
  // or null. Caller handles the guest login gate before calling this.
  const toggleSave = async (meal: MealType): Promise<string | null> => {
    const key = mealKey(meal);
    if (inFlight[key]) return null;
    setBusy(key, true);
    try {
      return await saved.toggle(meal);
    } finally {
      setBusy(key, false);
    }
  };

  const status: FeedStatus =
    isLoading || (allMeals && allMeals.length > 0 && meals.length === 0)
      ? "loading"
      : isError || !allMeals || allMeals.length === 0
        ? "error"
        : "ready";

  return {
    status,
    meals,
    activeIndex,
    setActiveIndex,
    isSaved: (meal: MealType) => !!saved.savedFor(meal),
    saveCountOf,
    inFlight,
    toggleSave,
    reset,
    retry: () => refetch(),
  };
}
