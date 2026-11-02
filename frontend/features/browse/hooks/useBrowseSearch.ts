import { useEffect, useRef, useState } from "react";
import { useAvoidFilter } from "@/frontend/core/preferences/hooks/useAvoidFilter";
import { browseMeals } from "@/api/meals";
import { mealRowToMealType } from "@/frontend/core/meals/utils/mealAdapter";
import type { MealType } from "@/frontend/core/meals/mealTypes";
import { FREE_DAILY_SEARCHES, GUEST_DAILY_SEARCHES, dailyLimitFor } from "@/frontend/core/pro/proContent";
import { useDailyLimit } from "@/frontend/core/pro/dailyLimits";
import { EMPTY_FILTERS, hasQueryFilters, type MealFilters } from "../utils/filters";

const DEBOUNCE_MS = 400;

// A search's signature for the daily limit: its words and filters.
const signatureOf = (q: string, filters: string) => JSON.stringify([q, filters]);

// Whether a search only refines the last one (free): the same words with
// other filters, or one query a prefix of the other ("sini" -> "sinigang",
// or back) under the same filters.
function refines(lastSignature: string, nextSignature: string) {
  const [lastQ, lastFilters] = JSON.parse(lastSignature) as [string, string];
  const [q, filters] = JSON.parse(nextSignature) as [string, string];
  if (lastQ === q) return true;
  if (lastFilters !== filters || !lastQ || !q) return false;
  return q.startsWith(lastQ) || lastQ.startsWith(q);
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
export function useBrowseSearch({ isGuest, isPro }: { isGuest: boolean; isPro: boolean }) {
  // Daily searches: guests, free accounts, none for Pro (see dailyLimits).
  // Pro: meals with an ingredient to avoid are flagged (isAvoided).
  const { isAvoided } = useAvoidFilter();
  const daily = useDailyLimit("search", dailyLimitFor({ isPro, isGuest }, GUEST_DAILY_SEARCHES, FREE_DAILY_SEARCHES));
  const [query, setQuery] = useState("");
  const [applied, setApplied] = useState<MealFilters>(EMPTY_FILTERS);
  const [results, setResults] = useState<MealType[]>([]);
  const [loading, setLoading] = useState(false);
  const [limitReached, setLimitReached] = useState(false);
  const requestId = useRef(0);

  // A new tier (signing in, going Pro) starts clear.
  useEffect(() => setLimitReached(false), [daily.limit]);

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
      const filtersKey = JSON.stringify([applied.proteinTypes, applied.dietaryTags, applied.tags, applied.restaurants, applied.priceRange]);
      if (!(await daily.use(signatureOf(trimmed.toLowerCase(), filtersKey), refines))) {
        if (id === requestId.current) {
          setLimitReached(true);
          setLoading(false);
        }
        return;
      }
      setLimitReached(false);
      let next: MealType[] = [];
      try {
        const rows = await browseMeals({
          q: trimmed || undefined,
          proteinTypes: applied.proteinTypes,
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
  }, [trimmed, applied.proteinTypes, applied.dietaryTags, applied.tags, applied.restaurants, applied.priceRange, daily.limit, isSearchMode]);

  // Pro: meals with an ingredient to avoid stay in the results, after the
  // rest, for the screen to show covered (AvoidedMealCover): hiding them
  // made a search look like the catalog had nothing.
  const sorted = order(results, applied.sortByPrice);

  return {
    query,
    setQuery,
    applied,
    setApplied,
    isSearchMode,
    loading,
    results: [...sorted.filter((meal) => !isAvoided(meal)), ...sorted.filter((meal) => isAvoided(meal))],
    /** True when a result uses an ingredient the user avoids. */
    isAvoided,
    limitReached,
    /** Today's limit for this user, null for Pro. */
    limit: daily.limit,
    /** Searches left today, null for Pro (or before it's read). */
    left: daily.left,
  };
}
