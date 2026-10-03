import { useEffect, useRef, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { browseMeals } from "@/api/meals";
import { mealRowToMealType } from "@/frontend/core/meals/utils/mealAdapter";
import type { MealType } from "@/frontend/core/meals/mealTypes";
import { EMPTY_FILTERS, hasQueryFilters, type MealFilters } from "../utils/filters";

const DEBOUNCE_MS = 400;
// Guests get this many searches per 24h, like the web. There's no server
// counter in this app (the query goes straight to Supabase), so it's kept
// on the device: a soft limit, not a security boundary.
const GUEST_DAILY_LIMIT = 3;
const GUEST_LIMIT_KEY = "browse_guest_searches";
const DAY_MS = 24 * 60 * 60 * 1000;

// Counts one guest search; false once today's limit is used up.
async function countGuestSearch(): Promise<boolean> {
  try {
    const raw = await AsyncStorage.getItem(GUEST_LIMIT_KEY);
    const now = Date.now();
    let state: { since: number; count: number } = raw ? JSON.parse(raw) : { since: now, count: 0 };
    if (now - state.since > DAY_MS) state = { since: now, count: 0 };
    if (state.count >= GUEST_DAILY_LIMIT) return false;
    await AsyncStorage.setItem(GUEST_LIMIT_KEY, JSON.stringify({ ...state, count: state.count + 1 }));
    return true;
  } catch {
    return true;
  }
}

function shuffle<T>(items: T[]): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function order(meals: MealType[], sort: MealFilters["sortByPrice"]) {
  if (!sort) return meals;
  return [...meals].sort((a, b) => (sort === "asc" ? Number(a.price) - Number(b.price) : Number(b.price) - Number(a.price)));
}

// Browse's search mode: a query and/or applied filters. Searches 400ms
// after the last change, ignores responses that arrive after a newer
// search started, and sorts on the device (otherwise results are
// shuffled). Sort alone isn't a search: it keeps the default view (the
// web showed an empty state there).
export function useBrowseSearch({ isGuest }: { isGuest: boolean }) {
  const [query, setQuery] = useState("");
  const [applied, setApplied] = useState<MealFilters>(EMPTY_FILTERS);
  const [results, setResults] = useState<MealType[]>([]);
  const [loading, setLoading] = useState(false);
  const [limitReached, setLimitReached] = useState(false);
  const requestId = useRef(0);

  // Signing in lifts the guest limit.
  useEffect(() => {
    if (!isGuest) setLimitReached(false);
  }, [isGuest]);

  const trimmed = query.trim();
  const isSearchMode = trimmed !== "" || hasQueryFilters(applied);

  useEffect(() => {
    const id = ++requestId.current;
    if (!isSearchMode) {
      setResults([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const timer = setTimeout(async () => {
      if (isGuest && !(await countGuestSearch())) {
        if (id === requestId.current) {
          setLimitReached(true);
          setLoading(false);
        }
        return;
      }
      let next: MealType[] = [];
      try {
        const rows = await browseMeals({
          q: trimmed || undefined,
          dietaryTags: applied.dietaryTags,
          tags: applied.tags,
          restaurants: applied.restaurants,
          priceRange: applied.priceRange,
        });
        next = shuffle(rows.map((row) => mealRowToMealType(row)));
      } catch {
        // Any error reads as "no results" (the curating empty state).
      }
      if (id !== requestId.current) return;
      setResults(next);
      setLoading(false);
    }, DEBOUNCE_MS);
    return () => clearTimeout(timer);
    // Sort is applied below without a new request.
  }, [trimmed, applied.dietaryTags, applied.tags, applied.restaurants, applied.priceRange, isGuest, isSearchMode]);

  return {
    query,
    setQuery,
    applied,
    setApplied,
    isSearchMode,
    loading,
    results: order(results, applied.sortByPrice),
    limitReached,
  };
}
