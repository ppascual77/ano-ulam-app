import { create } from "zustand";

// The grocery list sheet, openable from anywhere (Home's cart button, the
// "View list" action on a save toast) without going to Profile > Grocery.
// The sheet itself is mounted once at the app root (GroceryListSheetHost).

type GrocerySheetState = { open: boolean };

export const useGrocerySheetStore = create<GrocerySheetState>(() => ({ open: false }));

// Set by the save feedback store, so opening the list counts as having
// found it (the "added to your grocery list" hint toasts stop).
let onOpened: (() => void) | null = null;
export function onGroceryListOpened(callback: () => void) {
  onOpened = callback;
}

export function openGroceryList() {
  useGrocerySheetStore.setState({ open: true });
  onOpened?.();
}

export const closeGroceryList = () => useGrocerySheetStore.setState({ open: false });
