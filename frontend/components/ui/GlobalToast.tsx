import { create } from "zustand";
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

/** `withActions={false}` drops the toast's button (inside a sheet, where
 *  e.g. navigating to another tab would happen under the sheet). */
export function GlobalToast({ withActions = true }: { withActions?: boolean }) {
  const toast = useGlobalToastStore((s) => s.toast);
  const shown = toast && !withActions ? { ...toast, action: undefined } : toast;
  return <Toast toast={shown} onHide={() => hideGlobalToast(toast?.id)} />;
}
