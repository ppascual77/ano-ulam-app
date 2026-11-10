import { Platform } from "react-native";
import Constants from "expo-constants";
import { registerPushToken, unregisterPushToken } from "@/api/push";

// Push notifications (for now: "Your recipe is live", sent by the database
// when an admin approves a user's recipe). The phone's side: the permission,
// this install's Expo push token, and saving it to the account.

/** "granted": banners and sound. "quiet": iOS's provisional mode, turned on
 *  at sign-in with no prompt: pushes land silently in Notification Center
 *  (the user can Keep or Turn off there), and "Notify me" / Settings upgrade
 *  it to banners with iOS's prompt. "unavailable": this build has no
 *  notifications module (a dev build made before expo-notifications was
 *  added): everything here is a no-op and the notification UI hides,
 *  instead of the app crashing on launch. */
export type PushPermission = "granted" | "quiet" | "denied" | "undetermined" | "unavailable";

/** Pushes reach this phone (with banners or quietly): a token worth saving. */
export const canReceivePush = (p: PushPermission | null) => p === "granted" || p === "quiet";

type NotificationsModule = typeof import("expo-notifications");

// Loaded optionally: importing expo-notifications throws ("Cannot find
// native module 'ExpoPushTokenManager'") on a build without it.
const Notifications: NotificationsModule | null = (() => {
  try {
    return require("expo-notifications") as NotificationsModule;
  } catch {
    return null;
  }
})();

// Shown as a banner even while the app is open (the reward celebration plays
// on the next foreground either way).
Notifications?.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

const projectId: string | undefined = Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;

function toPermission(settings: Awaited<ReturnType<NotificationsModule["getPermissionsAsync"]>>): PushPermission {
  const ios = settings.ios?.status;
  if (ios === Notifications?.IosAuthorizationStatus.PROVISIONAL) return "quiet";
  if (settings.granted) return "granted";
  // Still askable: never decided, or (Android) not refused for good.
  if (ios === Notifications?.IosAuthorizationStatus.NOT_DETERMINED || (ios == null && settings.canAskAgain)) return "undetermined";
  return "denied";
}

export async function getPushPermission(): Promise<PushPermission> {
  if (!Notifications) return "unavailable";
  return toPermission(await Notifications.getPermissionsAsync());
}

// This install's token, or null where there isn't one (no module or
// projectId, a simulator without push, or no network).
async function currentToken(): Promise<string | null> {
  if (!Notifications || !projectId) {
    if (__DEV__) console.warn("[push] no token:", !Notifications ? "no notifications module in this build" : "no EAS projectId");
    return null;
  }
  try {
    return (await Notifications.getExpoPushTokenAsync({ projectId })).data;
  } catch (err) {
    if (__DEV__) console.warn("[push] getExpoPushTokenAsync failed:", err);
    return null;
  }
}

async function saveToken() {
  const token = await currentToken();
  if (!token) return;
  try {
    await registerPushToken(token, Platform.OS === "ios" ? "ios" : "android");
    if (__DEV__) console.log("[push] token saved:", token.slice(0, 22) + "…");
  } catch (err) {
    if (__DEV__) console.warn("[push] saving the token failed:", err);
    throw err;
  }
}

/** Banners and sound: iOS's prompt (from undecided or quiet; iOS shows it
 *  once), then saves this phone's token. True when banners are allowed. */
export async function enablePush(): Promise<boolean> {
  if (!Notifications) return false;
  let permission = await getPushPermission();
  if (permission === "undetermined" || permission === "quiet") {
    permission = toPermission(
      await Notifications.requestPermissionsAsync({ ios: { allowAlert: true, allowBadge: true, allowSound: true } }),
    );
  }
  if (__DEV__) console.log("[push] permission:", permission);
  if (canReceivePush(permission)) await saveToken();
  return permission === "granted";
}

/** Signed in: on by default. Undecided → quiet notifications (no prompt);
 *  already receiving → re-saves the token (it can change, and it moves to
 *  whoever is signed in now). Never shows a prompt. */
export async function syncPushToken() {
  if (!Notifications) return;
  let permission = await getPushPermission();
  if (permission === "undetermined" && Platform.OS === "ios") {
    permission = toPermission(
      await Notifications.requestPermissionsAsync({
        ios: { allowAlert: true, allowBadge: true, allowSound: true, allowProvisional: true },
      }),
    );
    if (__DEV__) console.log("[push] quiet by default:", permission);
  }
  if (canReceivePush(permission)) await saveToken();
}

/** Before logging out: this phone stops getting the account's pushes. */
export async function forgetPushToken() {
  try {
    if (!canReceivePush(await getPushPermission())) return;
    const token = await currentToken();
    if (token) await unregisterPushToken(token);
  } catch {
    // Logging out must never fail on this.
  }
}
