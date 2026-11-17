import { useEffect, useState } from "react";
import { Platform } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { FullWindowOverlay } from "react-native-screens";
import { create } from "zustand";
import { useModalSheetOpen } from "./BottomSheet";
import { Toast, type ToastState } from "./Toast";

// One app-wide toast for messages that don't belong to a single screen
// (e.g. "Saved to your Profile", which any save button can trigger).
// iOS: rendered once at the app root in a FullWindowOverlay, a layer above
// every native Modal, so sheets need no copy of their own and a toast fired
// as a sheet closes shows exactly once. Android has no such layer: the root
// copy hides while a modal sheet is open and each sheet shows its own.

const useGlobalToastStore = create<{ toast: ToastState | null }>(() => ({ toast: null }));

export function showGlobalToast(toast: Omit<ToastState, "id">) {
  useGlobalToastStore.setState({ toast: { ...toast, id: Date.now() } });
}

export function hideGlobalToast(id?: number) {
  const current = useGlobalToastStore.getState().toast;
  if (current && (id == null || current.id === id)) useGlobalToastStore.setState({ toast: null });
}

export const TOAST_ABOVE_SHEETS = Platform.OS === "ios";
// Longer than the toast's exit animation.
const OVERLAY_LINGER_MS = 400;

// Android: toasts already on screen in some layer. Another layer picking
// one up (the root, once a sheet that showed it has gone) shows it in place
// instead of sliding it in again.
const presented = new Set<number>();

/** `layer`: the app root, or inside a modal sheet (Android only; see
 *  BottomSheet). While a sheet is open the toast's button is dropped
 *  (navigating would happen under the sheet) unless it's marked `inSheet`
 *  (e.g. Undo). */
export function GlobalToast({ layer = "root" }: { layer?: "root" | "sheet" }) {
  const toast = useGlobalToastStore((s) => s.toast);
  const sheetOpen = useModalSheetOpen();
  const hidden = !TOAST_ABOVE_SHEETS && layer === "root" && sheetOpen;
  // Read before this layer marks it: true only when another layer already
  // showed it (the Toast uses it on mount / a new id only).
  const skipEnter = !TOAST_ABOVE_SHEETS && !!toast && presented.has(toast.id);
  useEffect(() => {
    if (toast && !hidden) presented.add(toast.id);
  }, [toast?.id, hidden]);
  // iOS: the overlay window is up only while there's a toast, and a moment
  // after, so the toast's exit animation still plays.
  const [overlayUp, setOverlayUp] = useState(false);
  useEffect(() => {
    if (toast) return setOverlayUp(true);
    const timer = setTimeout(() => setOverlayUp(false), OVERLAY_LINGER_MS);
    return () => clearTimeout(timer);
  }, [!!toast]);
  if (hidden) return null;
  const overSheet = layer === "sheet" || sheetOpen;
  const shown = toast && overSheet && !toast.action?.inSheet ? { ...toast, action: undefined } : toast;
  const view = <Toast toast={shown} skipEnter={skipEnter} onHide={() => hideGlobalToast(toast?.id)} />;
  if (!TOAST_ABOVE_SHEETS || layer === "sheet") return view;
  if (!toast && !overlayUp) return null;
  // Its own window: the swipe-to-dismiss gesture needs a gesture root there.
  return (
    <FullWindowOverlay>
      <GestureHandlerRootView style={{ flex: 1 }} pointerEvents="box-none">
        {view}
      </GestureHandlerRootView>
    </FullWindowOverlay>
  );
}
