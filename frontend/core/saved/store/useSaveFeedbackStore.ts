import AsyncStorage from "@react-native-async-storage/async-storage";
import type { View } from "react-native";
import { router } from "expo-router";
import type { ImageProps } from "expo-image";
import { create } from "zustand";
import { isModalSheetOpen, showGlobalToast } from "@/frontend/components/ui";
import { resolveMealImage } from "@/frontend/core/meals/resolveMealImage";
import type { MealType } from "@/frontend/core/meals/mealTypes";
import { SAVED_MEALS_LIMIT, savedKeyOf } from "../types";

// What a save looks like from anywhere in the app, so people learn where
// saved meals live (Profile > Saved):
//   1. the meal's photo flies from the tapped bookmark into the Profile tab
//      and lands as the orange dot on its avatar (SaveFeedbackLayer)
//   2. that dot stays until the Saved tab has been seen
//   3. a "Saved to your Profile" toast, only while it's still being learned
//      (first HINT_LIMIT saves, or until the Saved tab is opened), or
//      whenever the flight can't play (nav covered, no tap, Reduce motion)
// Unsaving gets an Undo toast; the saved-meals limit gets a Manage one.

const STORAGE_KEY = "anoulam.saveFeedback";
const HINT_LIMIT = 3;
// A tap older than this didn't start the save (e.g. a guest's save replayed
// after signing in), so there's nothing to fly from.
const TOUCH_FRESH_MS = 1000;

type Point = { x: number; y: number };
export type SaveFlight = { id: number; from: Point; to: Point; image: ImageProps["source"] };

type Persisted = { unseen: boolean; hintsShown: number; learned: boolean };

type SaveFeedbackState = Persisted & {
  /** Key of the meal saved last, for the Saved tab's one-time pulse. */
  lastSavedKey: string | null;
  flight: SaveFlight | null;
  /** Bumped when a flight lands, to pop the Profile avatar. */
  landed: number;
  /** Set by SaveFeedbackLayer from useReduceMotion (no hook here). */
  reduceMotion: boolean;
  load: () => Promise<void>;
};

export const useSaveFeedbackStore = create<SaveFeedbackState>((set) => ({
  unseen: false,
  hintsShown: 0,
  learned: false,
  lastSavedKey: null,
  flight: null,
  landed: 0,
  reduceMotion: false,
  load: async () => {
    try {
      const stored = await AsyncStorage.getItem(STORAGE_KEY);
      if (stored) set(JSON.parse(stored) as Persisted);
    } catch {
      // Unreadable: start fresh (worst case, a few extra hint toasts).
    }
  },
}));

function update(patch: Partial<Persisted>) {
  useSaveFeedbackStore.setState(patch);
  const { unseen, hintsShown, learned } = useSaveFeedbackStore.getState();
  AsyncStorage.setItem(STORAGE_KEY, JSON.stringify({ unseen, hintsShown, learned })).catch(() => {});
}

// ---- where the flight starts and lands --------------------------------------

let lastTouch: (Point & { at: number }) | null = null;
/** From the app root's onTouchStart: the tap that may be about to save. */
export function noteTouch(x: number, y: number) {
  lastTouch = { x, y, at: Date.now() };
}

let profileDot: View | null = null;
let tabBarShown = false;
/** From BottomNav's Profile tab: where the avatar's dot sits, and whether
 *  the tab bar is on screen (not under a pushed screen). */
export function registerProfileDot(node: View | null, shown: boolean) {
  profileDot = node;
  tabBarShown = shown;
}

function measureDot(): Promise<Point | null> {
  return new Promise((resolve) => {
    if (!profileDot) return resolve(null);
    const timer = setTimeout(() => resolve(null), 150);
    profileDot.measureInWindow((x, y, w, h) => {
      clearTimeout(timer);
      resolve(w > 0 ? { x: x + w / 2, y: y + h / 2 } : null);
    });
  });
}

let flightCount = 0;
export function finishSaveFlight(id: number) {
  const { flight, landed } = useSaveFeedbackStore.getState();
  if (flight?.id !== id) return;
  useSaveFeedbackStore.setState({ flight: null, landed: landed + 1 });
  update({ unseen: true });
}

// ---- toasts -------------------------------------------------------------------

/** Profile, opened on the Saved tab. */
export function openSavedTab() {
  router.navigate({ pathname: "/profile", params: { tab: "saved", at: String(Date.now()) } });
}

function hintToast(meal: MealType) {
  showGlobalToast({
    message: "Saved to your Profile",
    tone: "success",
    image: resolveMealImage(meal),
    action: { label: "View", onPress: openSavedTab },
  });
}

// ---- the events ---------------------------------------------------------------

export async function announceSaved(meal: MealType) {
  const state = useSaveFeedbackStore.getState();
  useSaveFeedbackStore.setState({ lastSavedKey: savedKeyOf(meal) });
  const learning = !state.learned && state.hintsShown < HINT_LIMIT;
  const touch = lastTouch && Date.now() - lastTouch.at < TOUCH_FRESH_MS ? lastTouch : null;
  lastTouch = null;

  const canFly = !!touch && tabBarShown && !isModalSheetOpen() && !state.reduceMotion;
  const to = canFly ? await measureDot() : null;

  if (touch && to) {
    useSaveFeedbackStore.setState({ flight: { id: ++flightCount, from: touch, to, image: resolveMealImage(meal) } });
  } else {
    // No flight to land it, so the dot just appears.
    update({ unseen: true });
  }

  if (learning) {
    update({ hintsShown: state.hintsShown + 1 });
    hintToast(meal);
  } else if (!to) {
    hintToast(meal);
  }
}

export function announceRemoved(meal: MealType, undo: () => void) {
  showGlobalToast({
    message: "Removed from your saved meals",
    tone: "success",
    image: resolveMealImage(meal),
    action: { label: "Undo", onPress: undo, inSheet: true },
  });
}

export function announceSaveError(message: string, isLimit: boolean) {
  showGlobalToast({
    message: isLimit ? `You've saved ${SAVED_MEALS_LIMIT} meals, the max. Remove one to save more.` : message,
    tone: "error",
    action: isLimit ? { label: "Manage", onPress: openSavedTab } : undefined,
  });
}

/** The Saved tab is on screen: clear the dot, stop the hint toasts. Returns
 *  the key of the meal to pulse once (saved since the tab was last seen). */
export function markSavedSeen(): string | null {
  const { unseen, learned, lastSavedKey } = useSaveFeedbackStore.getState();
  if (unseen || !learned) update({ unseen: false, learned: true });
  return unseen ? lastSavedKey : null;
}
