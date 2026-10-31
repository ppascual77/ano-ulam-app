import { useQuery, useQueryClient } from "@tanstack/react-query";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { addToPantry, listPantry, savePantry } from "@/api/pantry";
import { useAuth } from "@/frontend/features/auth/hooks/useAuth";
import type { PantryIngredient } from "../types";

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
  const persist = async () => {
    const current = queryClient.getQueryData<PantryIngredient[]>(key);
    if (!current) return;
    try {
      if (userId) await savePantry(current.map((item) => item.id));
      else await AsyncStorage.setItem(GUEST_KEY, JSON.stringify(current));
    } catch {
      // Kept in the cache; saved on the next persist.
    }
  };

  return {
    // Adding happens in the Add Ingredients sheet, saved when it closes.
    add: (item: PantryIngredient) => {
      const current = read();
      if (!current.some((i) => i.id === item.id)) write([...current, item]);
    },
    // A chip's x is a single, final tap: saved right away.
    remove: (id: string) => {
      write(read().filter((i) => i.id !== id));
      void persist();
    },
    persist,
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
