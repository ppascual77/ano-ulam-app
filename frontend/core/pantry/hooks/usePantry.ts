import { useQuery, useQueryClient, type QueryClient } from "@tanstack/react-query";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { addToPantry, listPantry, savePantry } from "@/api/pantry";
import { useAuth } from "@/frontend/features/auth/hooks/useAuth";
import type { PantryIngredient } from "../types";
import { useRecentlyRemovedStore } from "../store/useRecentlyRemovedStore";

// Where the pantry lives: a signed-in user's in public.pantry_items (see
// api/pantry), a guest's on the phone. A guest who signs in keeps theirs:
// the first load after signing in adds it to their account, then clears it
// from the phone.
const GUEST_KEY = "anoulam.guestPantry";

const pantryKeys = { list: (userId: string | null) => ["pantry", "list", userId ?? "guest"] as const };

// What a pantry view says while the pantry loads.
export const PANTRY_LOADING_LABEL = "Peeking into your pantry…";

async function readGuestPantry(): Promise<PantryIngredient[]> {
  try {
    const raw = await AsyncStorage.getItem(GUEST_KEY);
    return raw ? (JSON.parse(raw) as PantryIngredient[]) : [];
  } catch {
    return [];
  }
}

async function loadPantry(userId: string | null): Promise<PantryIngredient[]> {
  if (!userId) return readGuestPantry();
  const fromGuest = await readGuestPantry();
  if (fromGuest.length > 0) {
    await addToPantry(fromGuest.map((item) => item.id));
    await AsyncStorage.removeItem(GUEST_KEY).catch(() => {});
  }
  return listPantry();
}

/** Puts these on a guest's phone pantry (onboarding's basics). A guest who
 *  signs in right after keeps them: loadPantry moves them to the account. */
export async function addToGuestPantry(items: PantryIngredient[]): Promise<void> {
  const current = await readGuestPantry();
  const ids = new Set(current.map((item) => item.id));
  const next = [...current, ...items.filter((item) => !ids.has(item.id))];
  await AsyncStorage.setItem(GUEST_KEY, JSON.stringify(next));
}

// Saves run one at a time, each sending the list as it is when its turn
// comes, so a quick run of ticks can't land out of order and bring back
// something just removed.
let saveQueue: Promise<void> = Promise.resolve();
let saveTimer: ReturnType<typeof setTimeout> | null = null;
const SAVE_DEBOUNCE_MS = 600;

function queueSave(queryClient: QueryClient, key: readonly unknown[], userId: string | null) {
  saveQueue = saveQueue.then(async () => {
    const current = queryClient.getQueryData<PantryIngredient[]>(key);
    if (!current) return;
    try {
      if (userId) await savePantry(current.map((item) => item.id));
      else await AsyncStorage.setItem(GUEST_KEY, JSON.stringify(current));
    } catch {
      // Kept in the cache; saved on the next save.
    }
  });
  return saveQueue;
}

export function usePantry() {
  const userId = useAuth().session?.user.id ?? null;
  return useQuery({ queryKey: pantryKeys.list(userId), queryFn: () => loadPantry(userId), staleTime: Infinity });
}

// Edits go straight into the cached list (so Grocery's "Have" tags see
// them right away); `persist` saves the list: when the Add Ingredients
// sheet closes, when leaving the Pantry tab, and on each removal.
export function usePantryActions() {
  const queryClient = useQueryClient();
  const userId = useAuth().session?.user.id ?? null;
  const key = pantryKeys.list(userId);
  const read = () => queryClient.getQueryData<PantryIngredient[]>(key) ?? [];
  const write = (next: PantryIngredient[]) => queryClient.setQueryData(key, next);

  // Not before the pantry has loaded: that would save an empty list over
  // the real one (e.g. leaving Profile's Pantry tab mid-load). A failed save
  // keeps the edits on screen; the next save sends them again.
  const persist = () => queueSave(queryClient, key, userId);
  // A burst of edits (ticking down a grocery list) saves once it settles.
  const persistSoon = () => {
    if (saveTimer) clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
      saveTimer = null;
      void persist();
    }, SAVE_DEBOUNCE_MS);
  };

  return {
    // Adding happens in the Add Ingredients sheet, saved when it closes.
    add: (item: PantryIngredient) => {
      const current = read();
      if (!current.some((i) => i.id === item.id)) write([...current, item]);
    },
    // A chip's x is a single, final tap: saved right away, and offered back
    // under the sheet's "Recently removed".
    remove: (id: string) => {
      const current = read();
      const removed = current.find((i) => i.id === id);
      if (removed) useRecentlyRemovedStore.getState().record(removed);
      write(current.filter((i) => i.id !== id));
      void persist();
    },
    persist,
    // The grocery list and "Anything used up?": items come and go as you
    // tick, without "Recently removed" (each has its own Undo).
    addMany: (items: PantryIngredient[]) => {
      const current = read();
      const ids = new Set(current.map((i) => i.id));
      const fresh = items.filter((i) => !ids.has(i.id));
      if (fresh.length === 0) return;
      write([...current, ...fresh]);
      persistSoon();
    },
    removeMany: (ids: string[]) => {
      const gone = new Set(ids);
      const current = read();
      if (!current.some((i) => gone.has(i.id))) return;
      write(current.filter((i) => !gone.has(i.id)));
      persistSoon();
    },
  };
}

// Whether a grocery item is something the user already has: a pantry name
// appears in the item name, followed by the end or a space , ( or ).
export function pantryHas(pantry: PantryIngredient[], itemName: string): boolean {
  const name = itemName.toLowerCase();
  return pantry.some((p) => {
    const needle = p.name.toLowerCase();
    let from = name.indexOf(needle);
    while (from !== -1) {
      const next = name[from + needle.length];
      if (next === undefined || " ,()".includes(next)) return true;
      from = name.indexOf(needle, from + 1);
    }
    return false;
  });
}
