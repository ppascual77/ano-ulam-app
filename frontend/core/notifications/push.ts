import { Platform } from "react-native";
import Constants from "expo-constants";
import * as Notifications from "expo-notifications";
import { registerPushToken, unregisterPushToken } from "@/api/push";

// Push notifications (for now: "Your recipe is live", sent by the database
// when an admin approves a user's recipe). The phone's side: the permission,
// this install's Expo push token, and saving it to the account.

export type PushPermission = "granted" | "denied" | "undetermined";

// Shown as a banner even while the app is open (the reward celebration plays
// on the next foreground either way).
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

const projectId: string | undefined = Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;

const toPermission = (settings: Notifications.NotificationPermissionsStatus): PushPermission => {
  if (settings.granted || settings.ios?.status === Notifications.IosAuthorizationStatus.PROVISIONAL) return "granted";
  return settings.canAskAgain ? "undetermined" : "denied";
};

export async function getPushPermission(): Promise<PushPermission> {
  return toPermission(await Notifications.getPermissionsAsync());
}

// This install's token, or null where there isn't one (no projectId, a
// simulator without push, or no network).
async function currentToken(): Promise<string | null> {
  if (!projectId) return null;
  try {
    return (await Notifications.getExpoPushTokenAsync({ projectId })).data;
  } catch {
    return null;
  }
}

async function saveToken() {
  const token = await currentToken();
  if (token) await registerPushToken(token, Platform.OS === "ios" ? "ios" : "android");
}

/** Asks for permission (the system prompt, once), then saves this phone's
 *  token. True when notifications are allowed. */
export async function enablePush(): Promise<boolean> {
  let permission = await getPushPermission();
  if (permission === "undetermined") permission = toPermission(await Notifications.requestPermissionsAsync());
  if (permission !== "granted") return false;
  await saveToken();
  return true;
}

/** Signed in and already allowed: re-saves the token (it can change, and it
 *  moves to whoever is signed in now). Never prompts. */
export async function syncPushToken() {
  if ((await getPushPermission()) !== "granted") return;
  await saveToken();
}

/** Before logging out: this phone stops getting the account's pushes. */
export async function forgetPushToken() {
  try {
    if ((await getPushPermission()) !== "granted") return;
    const token = await currentToken();
    if (token) await unregisterPushToken(token);
  } catch {
    // Logging out must never fail on this.
  }
}
