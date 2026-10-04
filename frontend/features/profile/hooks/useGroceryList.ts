import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AppState } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useSavedMeals } from "@/frontend/core/saved/hooks/useSavedMeals";
import { flushGroceryChecks, getGroceryChecks } from "../mock/api";
import { buildGroceryList, type GroceryItem } from "@/frontend/core/grocery/utils/buildGroceryList";

const checksKey = ["grocery", "checks"] as const;
type Pending = Record<string, string | null>;

// The grocery list (rebuilt from saved meals whenever they change) plus its
// checkboxes. A tap flips the box instantly and is kept on the phone
// (AsyncStorage) as a pending change; pending changes go to the server in
// one batch via `flush` (leaving the tab, closing the full list) or when
// the app goes to the background. Pending values win over the server's.
export function useGroceryList(userId: string | null) {
  const queryClient = useQueryClient();
  const saved = useSavedMeals();
  const checks = useQuery({ queryKey: checksKey, queryFn: getGroceryChecks });
  const items = useMemo(() => buildGroceryList(saved.data ?? []), [saved.data]);

  const storageKey = `grocery_checked_${userId ?? "dev"}`;
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
    if (Object.keys(changes).length === 0) return;
    try {
      await flushGroceryChecks(changes);
      queryClient.setQueryData<Record<string, string>>(checksKey, (prev) => {
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
  }, [queryClient, storageKey]);

  useEffect(() => {
    const subscription = AppState.addEventListener("change", (state) => {
      if (state !== "active") void flush();
    });
    return () => subscription.remove();
  }, [flush]);

  return { items, loading: saved.isLoading || checks.isLoading, isChecked, toggle, flush };
}
