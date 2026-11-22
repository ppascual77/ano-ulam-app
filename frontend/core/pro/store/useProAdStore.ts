import AsyncStorage from "@react-native-async-storage/async-storage";
import { AppState } from "react-native";
import { create } from "zustand";
import type { ProFeatureKey } from "../components/ProFeatureSheet";

// The Pro ad: one Pro feature in the feature sheet, now and then, for free
// users and guests. Never when the app opens (Home already has its own
// nudges then): it counts taps through the day and comes up at the 20th
// and the 50th, so at most twice a day, and only once things are calm
// (ProAdHost: no sheet open, no keyboard, not mid-flow).
//
// Kept gentle:
// - Not in the first 15 minutes after install (the first-run tours run
//   then). Was a whole day (CHG-1, 2026-11-22): too quiet to ever be seen.
// - A slot is dropped when another Pro sheet (a limit, a locked feature)
//   showed within the last hour: one pitch is enough.
// - Each feature comes up once before any repeats (a shuffled bag).
// Counted on the phone: a soft promo, not a gate.

export const AD_TAP_SLOTS = [20, 50] as const;
const GRACE_MS = 15 * 60 * 1000;
const QUIET_AFTER_PRO_SHEET_MS = 60 * 60 * 1000;
// A slot that couldn't show on its tap tries again on later taps, a beat
// after each, so it never lands on top of what that tap opened.
export const AD_DELAY_MS = 1200;

const ROTATION: ProFeatureKey[] = ["planLength", "avoid", "goals", "alerts", "narration", "saves", "micronutrients", "limits"];
const STORAGE_KEY = "anoulam.proAd";

type Saved = {
  firstSeen: number;
  day: string;
  taps: number;
  bag: ProFeatureKey[];
};

type ProAdStore = Saved & {
  loaded: boolean;
  /** A slot was reached and is waiting for a calm moment. */
  due: boolean;
  /** The feature on screen, or null. */
  showing: ProFeatureKey | null;
  load: () => Promise<void>;
  /** One tap anywhere in the app (the root view's tap counter). */
  noteTap: () => void;
  /** Shows the due ad (ProAdHost checks the moment is calm first). */
  show: () => void;
  close: () => void;
};

const today = () => {
  const d = new Date();
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
};

const shuffled = () => {
  const bag = [...ROTATION];
  for (let i = bag.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [bag[i], bag[j]] = [bag[j], bag[i]];
  }
  return bag;
};

// When any other Pro sheet last showed (this launch is enough: it's for
// the hour after).
let lastProSheet = 0;
/** Called by the feature and limit sheets when they open. */
export const noteProSheetShown = () => {
  lastProSheet = Date.now();
};

export const useProAdStore = create<ProAdStore>((set, get) => {
  const save = () => {
    const { firstSeen, day, taps, bag } = get();
    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify({ firstSeen, day, taps, bag } satisfies Saved)).catch(() => {});
  };
  // Taps are saved as the app goes to the background, not on every tap.
  AppState.addEventListener("change", (state) => {
    if (state !== "active" && get().loaded) save();
  });

  return {
    firstSeen: Date.now(),
    day: today(),
    taps: 0,
    bag: [],
    loaded: false,
    due: false,
    showing: null,
    load: async () => {
      try {
        const raw = await AsyncStorage.getItem(STORAGE_KEY);
        if (raw) set({ ...(JSON.parse(raw) as Saved) });
      } catch {
        // A fresh start: only the counts are lost.
      }
      set({ loaded: true });
      save();
    },
    noteTap: () => {
      const s = get();
      if (!s.loaded || s.showing) return;
      const day = today();
      const taps = s.day === day ? s.taps + 1 : 1;
      set({ day, taps, due: s.day === day ? s.due : false });
      if (!(AD_TAP_SLOTS as readonly number[]).includes(taps)) return;
      if (Date.now() - s.firstSeen < GRACE_MS) return;
      if (Date.now() - lastProSheet < QUIET_AFTER_PRO_SHEET_MS) return;
      set({ due: true });
      save();
    },
    show: () => {
      const s = get();
      if (!s.due || s.showing) return;
      const bag = s.bag.length ? s.bag : shuffled();
      set({ showing: bag[0], bag: bag.slice(1), due: false });
      save();
    },
    close: () => set({ showing: null }),
  };
});

// Tap detection for the root view: a touch that ends near where it began,
// quickly (a scroll or a drag isn't a tap).
let touchStart: { x: number; y: number; t: number } | null = null;
export const adTouchStart = (x: number, y: number) => {
  touchStart = { x, y, t: Date.now() };
};
export const adTouchEnd = (x: number, y: number) => {
  const start = touchStart;
  touchStart = null;
  if (!start || Date.now() - start.t > 600 || Math.hypot(x - start.x, y - start.y) > 12) return;
  useProAdStore.getState().noteTap();
};
