import { useState } from "react";
import { showGlobalToast } from "@/frontend/components/ui";
import { useProStore } from "../store/useProStore";
import { STORE } from "../subscriptionCopy";

/** Restore purchases (the store's own receipts, through RevenueCat), with the
 *  same messages wherever it's offered: the Pro page, Settings and the
 *  Expired plan card (IMP-8). `restoring` while it runs. */
export function useRestorePurchases() {
  const restore = useProStore((s) => s.restore);
  const [restoring, setRestoring] = useState(false);
  const run = async () => {
    if (restoring) return;
    setRestoring(true);
    try {
      const found = await restore();
      showGlobalToast(
        found
          ? { message: "Pro is back on.", tone: "success" }
          : { message: `No Pro subscription found for this ${STORE.account}.`, tone: "error" },
      );
    } catch {
      showGlobalToast({ message: "Couldn't restore. Check your connection.", tone: "error" });
    } finally {
      setRestoring(false);
    }
  };
  return { restore: run, restoring };
}
