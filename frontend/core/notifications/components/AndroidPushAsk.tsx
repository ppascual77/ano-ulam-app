import { useEffect } from "react";
import { Platform, View } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Bell } from "lucide-react-native";
import { create } from "zustand";
import { ConfirmSheet, useModalSheetOpen } from "@/frontend/components/ui";
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
//
// Most saves happen inside a meal's page, which is a modal sheet, and Android
// can't show this sheet over it well. It used to give up when a sheet was
// open, so it never showed for anyone saving from a meal's page (BUG-1,
// 2026-11-21). Now it waits until every sheet has closed, then asks.

const STORAGE_KEY = "anoulam.androidPushAsked";
// After the save's flight and toast have played.
const ASK_DELAY_MS = 1600;
// Once the last sheet is gone: let its slide-out finish first.
const AFTER_SHEET_MS = 500;

// wanted: a save asked for it; open: on screen.
const useAskStore = create<{ wanted: boolean; open: boolean }>(() => ({ wanted: false, open: false }));

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
  if (Platform.OS !== "android" || pending) return;
  if (await alreadyAsked()) {
    if (__DEV__) console.log("[push] Android ask: skipped, already asked on this phone");
    return;
  }
  const permission = await getPushPermission().catch(() => "unavailable");
  if (permission !== "undetermined") {
    if (__DEV__) console.log("[push] Android ask: skipped, permission is", permission);
    return;
  }
  pending = true;
  if (__DEV__) console.log("[push] Android ask: queued after a save");
  setTimeout(() => {
    pending = false;
    useAskStore.setState({ wanted: true });
  }, ASK_DELAY_MS);
}

/** Rendered once in the root layout. */
export function AndroidPushAsk() {
  const { wanted, open } = useAskStore();
  const { isSignedIn } = useAuth();
  const sheetOpen = useModalSheetOpen();

  // Shown once no sheet is up (a meal's page, the save limit, login). Not
  // marked as asked until it actually shows, so an app closed meanwhile
  // asks again on a later save.
  useEffect(() => {
    if (!wanted || sheetOpen || !isSignedIn) return;
    const timer = setTimeout(() => {
      if (__DEV__) console.log("[push] Android ask: showing");
      markAsked();
      useAskStore.setState({ wanted: false, open: true });
    }, AFTER_SHEET_MS);
    return () => clearTimeout(timer);
  }, [wanted, sheetOpen, isSignedIn]);

  // Signed out mid-delay: nothing to send pushes to.
  useEffect(() => {
    if ((open || wanted) && !isSignedIn) useAskStore.setState({ wanted: false, open: false });
  }, [open, wanted, isSignedIn]);

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
