import { useEffect } from "react";
import { Platform, View } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Bell } from "lucide-react-native";
import { create } from "zustand";
import { ConfirmSheet, isModalSheetOpen } from "@/frontend/components/ui";
import { colors } from "@/frontend/constants/theme";
import { useAuth } from "@/frontend/features/auth/hooks/useAuth";
import { enablePush, getPushPermission } from "../push";

// Android's notification ask, once per phone. iOS turns on quiet
// notifications at sign-in with no prompt (syncPushToken); Android 13+ has
// no quiet mode, so without this most Android users never allowed pushes and
// got none (audit A6). Asked right after a first save, when the person is
// clearly using the app, with a short sheet saying what they'd get; "Turn on"
// then shows Android's own dialog. "Not now" never asks again: Settings →
// Notifications still turns them on.

const STORAGE_KEY = "anoulam.androidPushAsked";
// After the save's flight and toast have played.
const ASK_DELAY_MS = 1600;

const useAskStore = create<{ open: boolean }>(() => ({ open: false }));

let asked: boolean | null = null;
let pending = false;

async function alreadyAsked(): Promise<boolean> {
  if (asked == null) {
    try {
      asked = (await AsyncStorage.getItem(STORAGE_KEY)) === "1";
    } catch {
      asked = false;
    }
  }
  return asked;
}

function markAsked() {
  asked = true;
  AsyncStorage.setItem(STORAGE_KEY, "1").catch(() => {});
}

/** After a save (signed in): opens the ask if this Android phone has never
 *  decided on notifications and hasn't been asked. Safe to call anywhere. */
export async function maybeAskAndroidPush() {
  if (Platform.OS !== "android" || pending || (await alreadyAsked())) return;
  if ((await getPushPermission().catch(() => "unavailable")) !== "undetermined") return;
  pending = true;
  setTimeout(() => {
    pending = false;
    // A sheet is up (save limit, login): try again on a later save.
    if (isModalSheetOpen()) return;
    markAsked();
    useAskStore.setState({ open: true });
  }, ASK_DELAY_MS);
}

/** Rendered once in the root layout. */
export function AndroidPushAsk() {
  const open = useAskStore((s) => s.open);
  const { isSignedIn } = useAuth();
  // Signed out mid-delay: nothing to send pushes to.
  useEffect(() => {
    if (open && !isSignedIn) useAskStore.setState({ open: false });
  }, [open, isSignedIn]);

  const close = () => useAskStore.setState({ open: false });

  return (
    <ConfirmSheet
      visible={open && isSignedIn}
      tone="primary"
      icon={
        <View className="h-12 w-12 items-center justify-center rounded-full bg-primary/10">
          <Bell color={colors.primary} size={22} />
        </View>
      }
      title="Get a heads-up"
      body="This week's best buys at the market, new meals every Sunday, and word when your recipe goes live. Turn them off anytime in Settings."
      cancelLabel="Not now"
      confirmLabel="Turn on"
      onCancel={close}
      onConfirm={() => {
        close();
        void enablePush("android_prompt").catch(() => false);
      }}
    />
  );
}
