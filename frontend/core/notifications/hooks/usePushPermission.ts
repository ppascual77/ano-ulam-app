import { useCallback, useEffect, useState } from "react";
import { AppState } from "react-native";
import { useAuth } from "@/frontend/features/auth/hooks/useAuth";
import { getPushPermission, syncPushToken, type PushPermission } from "../push";

/** The phone's notification permission, re-read when the app comes back to
 *  the front (the user may have changed it in iOS Settings). null until read. */
export function usePushPermission() {
  const [permission, setPermission] = useState<PushPermission | null>(null);
  const refresh = useCallback(() => {
    getPushPermission()
      .then(setPermission)
      .catch(() => setPermission("denied"));
  }, []);
  useEffect(() => {
    refresh();
    const sub = AppState.addEventListener("change", (state) => state === "active" && refresh());
    return () => sub.remove();
  }, [refresh]);
  return { permission, refresh };
}

/** Root layout: whenever someone signs in, notifications are on by default:
 *  quiet ones (no prompt) unless they've decided, and this phone's token
 *  saved to their account. */
export function usePushTokenSync() {
  const userId = useAuth().session?.user.id;
  useEffect(() => {
    if (!userId) return;
    syncPushToken().catch(() => {});
  }, [userId]);
}
