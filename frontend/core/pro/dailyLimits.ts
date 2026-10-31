import { useCallback, useEffect, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";

// Daily limits on finding meals for non-Pro users: Browse search, Suggest
// by Budget, Suggest by Pantry (limits in proContent). Each kind has its own
// count. There's no server counter (these go straight to Supabase or run on
// the device), so it's kept on the device: a soft limit, not a security
// boundary. One count per device per day (a guest who signs in keeps what
// they've used), reset at local midnight.
//
// Only something new counts: repeating a use from earlier today is free,
// and so is refining the last one (the caller says what counts as that).

export type LimitKind = "search" | "budget" | "pantry";

type DailyUses = {
  day: string;
  count: number;
  /** Today's uses that counted, by signature: repeats are free. */
  seen: string[];
  /** The last use's signature, for refinements. */
  last: string | null;
};

const storageKey = (kind: LimitKind) => `anoulam.daily.${kind}`;

function today() {
  const d = new Date();
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
}

async function readUses(kind: LimitKind): Promise<DailyUses> {
  const fresh: DailyUses = { day: today(), count: 0, seen: [], last: null };
  try {
    const raw = await AsyncStorage.getItem(storageKey(kind));
    const saved = raw ? (JSON.parse(raw) as DailyUses) : null;
    return saved && saved.day === fresh.day ? saved : fresh;
  } catch {
    return fresh;
  }
}

/** Counts a use against `limit` (null: no limit). False when it's new and
 *  today's limit is used up. `refines(last, next)`: whether `next` only
 *  refines the last use (free). */
export async function countUse(
  kind: LimitKind,
  signature: string,
  limit: number | null,
  refines?: (last: string, next: string) => boolean,
): Promise<boolean> {
  if (limit == null) return true;
  const uses = await readUses(kind);
  const repeat = uses.seen.includes(signature);
  const free = repeat || (uses.last != null && !!refines?.(uses.last, signature));
  if (!free && uses.count >= limit) return false;
  const next: DailyUses = {
    ...uses,
    count: free ? uses.count : uses.count + 1,
    seen: repeat ? uses.seen : [...uses.seen, signature],
    last: signature,
  };
  try {
    await AsyncStorage.setItem(storageKey(kind), JSON.stringify(next));
  } catch {
    // Unsaved: this use just doesn't count.
  }
  return true;
}

/** Uses left today under `limit`. */
export async function usesLeft(kind: LimitKind, limit: number): Promise<number> {
  const uses = await readUses(kind);
  return Math.max(0, limit - uses.count);
}

/** A quiet "2 searches left today" line at 2 or 1 left; null otherwise
 *  (out of them, DailyLimitSheet says so instead). `noun` is singular. */
export function leftHint(left: number | null, noun: string, plural = `${noun}s`): string | null {
  if (left == null || left > 2 || left === 0) return null;
  return `${left} ${left === 1 ? noun : plural} left today`;
}

/** One kind's limit for a screen: what's left today, and `use` to count a
 *  use (false when out). `limit` null means no limit (Pro). */
export function useDailyLimit(kind: LimitKind, limit: number | null) {
  const [left, setLeft] = useState<number | null>(null);

  const refresh = useCallback(() => {
    if (limit == null) return setLeft(null);
    void usesLeft(kind, limit).then(setLeft);
  }, [kind, limit]);
  useEffect(refresh, [refresh]);

  const use = useCallback(
    async (signature: string, refines?: (last: string, next: string) => boolean) => {
      const ok = await countUse(kind, signature, limit, refines);
      refresh();
      return ok;
    },
    [kind, limit, refresh],
  );

  return { limit, left, use, refresh };
}
