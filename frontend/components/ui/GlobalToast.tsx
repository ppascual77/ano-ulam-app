import { useEffect } from "react";
import { create } from "zustand";
import { useModalSheetOpen } from "./BottomSheet";
import { Toast, type ToastState } from "./Toast";

// One app-wide toast for messages that don't belong to a single screen
// (e.g. "Saved to your Profile", which any save button can trigger).
// Rendered at the app root and again inside every modal BottomSheet, since
// a native Modal covers the root: whichever layer is on top shows it.

const useGlobalToastStore = create<{ toast: ToastState | null }>(() => ({ toast: null }));

export function showGlobalToast(toast: Omit<ToastState, "id">) {
  useGlobalToastStore.setState({ toast: { ...toast, id: Date.now() } });
}

export function hideGlobalToast(id?: number) {
  const current = useGlobalToastStore.getState().toast;
  if (current && (id == null || current.id === id)) useGlobalToastStore.setState({ toast: null });
}

// Toasts already on screen in some layer: another layer picking one up
// (the root, once a sheet that showed it has gone) shows it in place
// instead of sliding it in again.
const presented = new Set<number>();

/** `layer`: the app root, or inside a modal sheet. The root's copy stays
 *  hidden while any modal sheet is open, so a toast fired as a sheet closes
 *  shows once, not twice (the sheet's copy and the root's, overlapping
 *  while the sheet slides away). Inside a sheet the toast's button is
 *  dropped (navigating would happen under the sheet) unless it's marked
 *  `inSheet` (e.g. Undo). */
export function GlobalToast({ layer = "root" }: { layer?: "root" | "sheet" }) {
  const toast = useGlobalToastStore((s) => s.toast);
  const sheetOpen = useModalSheetOpen();
  const hidden = layer === "root" && sheetOpen;
  // Read before this layer marks it: true only when another layer already
  // showed it (the Toast uses it on mount / a new id only).
  const skipEnter = !!toast && presented.has(toast.id);
  useEffect(() => {
    if (toast && !hidden) presented.add(toast.id);
  }, [toast?.id, hidden]);
  if (hidden) return null;
  const shown = toast && layer === "sheet" && !toast.action?.inSheet ? { ...toast, action: undefined } : toast;
  return <Toast toast={shown} skipEnter={skipEnter} onHide={() => hideGlobalToast(toast?.id)} />;
}
