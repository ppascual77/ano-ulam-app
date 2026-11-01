import { useCallback, useEffect, useRef, useState } from "react";
import { AppState } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { applyGroceryChecks, clearGroceryChecks, listGroceryChecks, type GroceryListKind } from "@/api/groceryChecks";
import type { GroceryItem } from "../utils/buildGroceryList";

export const groceryChecksKey = (list: GroceryListKind, userId: string | null) =>
  ["grocery", "checks", list, userId ?? "guest"] as const;
type Pending = Record<string, string | null>;

// One grocery list's checkboxes ("saved": the saved-meals list, "plan": the
// meal plan's). A tap flips the box instantly and is kept on the phone
// (AsyncStorage) as a pending change; pending changes go to the server in
// one batch via `flush` (leaving the tab, closing the full list) or when
// the app goes to the background. Pending values win over the server's.
// The server is public.grocery_checks (api/groceryChecks), per account and
// list; without an account, checks stay on the phone.
export function useGroceryChecks(list: GroceryListKind, userId: string | null) {
  const queryClient = useQueryClient();
  const key = groceryChecksKey(list, userId);
  const checks = useQuery({
    queryKey: key,
    queryFn: () => (userId ? listGroceryChecks(list) : Promise.resolve({} as Record<string, string>)),
  });

  // The saved list keeps its original key, so ticks made before lists
  // existed carry over.
  const storageKey = list === "saved" ? `grocery_checked_${userId ?? "dev"}` : `grocery_${list}_checked_${userId ?? "dev"}`;
  const [pending, setPending] = useState<Pending>({});
  const pendingRef = useRef<Pending>({});

  const setBoth = (next: Pending) => {
    pendingRef.current = next;
    setPending(next);
  };

  useEffect(() => {
    AsyncStorage.getItem(storageKey)
      .then((raw) => raw && setBoth({ ...JSON.parse(raw), ...pendingRef.current }))
      .catch(() => {});
  }, [storageKey]);

  const isChecked = useCallback(
    (item: GroceryItem) => {
      const value = item.id in pending ? pending[item.id] : checks.data?.[item.id];
      // Checked at a different quantity = needs restocking = unchecked.
      return value === item.qty;
    },
    [pending, checks.data],
  );

  const toggle = (item: GroceryItem) => {
    const next = { ...pendingRef.current, [item.id]: isChecked(item) ? null : item.qty };
    setBoth(next);
    AsyncStorage.setItem(storageKey, JSON.stringify(next)).catch(() => {});
  };

  const flush = useCallback(async () => {
    const changes = pendingRef.current;
    // Nowhere to send them without an account: they stay on the phone.
    if (!userId || Object.keys(changes).length === 0) return;
    try {
      await applyGroceryChecks(list, changes);
      queryClient.setQueryData<Record<string, string>>(groceryChecksKey(list, userId), (prev) => {
        const next = { ...prev };
        for (const [id, qty] of Object.entries(changes)) {
          if (qty === null) delete next[id];
          else next[id] = qty;
        }
        return next;
      });
      setBoth({});
      await AsyncStorage.removeItem(storageKey);
    } catch {
      // Kept locally; the next flush retries.
    }
  }, [list, queryClient, storageKey, userId]);

  // Every box unticked, here and on the server (a new meal plan).
  const reset = useCallback(async () => {
    setBoth({});
    queryClient.setQueryData(groceryChecksKey(list, userId), {});
    await AsyncStorage.removeItem(storageKey).catch(() => {});
    if (userId) await clearGroceryChecks(list).catch(() => {});
  }, [list, queryClient, storageKey, userId]);

  useEffect(() => {
    const subscription = AppState.addEventListener("change", (state) => {
      if (state !== "active") void flush();
    });
    return () => subscription.remove();
  }, [flush]);

  return { isChecked, toggle, flush, reset, loading: checks.isLoading };
}
