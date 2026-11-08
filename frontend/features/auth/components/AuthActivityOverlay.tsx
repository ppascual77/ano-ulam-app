import { useEffect, useState } from "react";
import { Modal, View } from "react-native";
import { AppText, Spinner } from "@/frontend/components/ui";
import { colors } from "@/frontend/constants/theme";
import { type AuthActivity, useAuthActivityStore } from "../store/useAuthActivityStore";

const SPIRAL_SIZE = 72;
// How long the overlay outlives the activity itself: the screen underneath
// still has to swap in its new state (the signed-in view, or Home after a
// log-out), and lifting the overlay straight away showed a glimpse of the
// old page.
const SETTLE_MS = 450;

const LABELS: Record<AuthActivity, string> = {
  signingIn: "Signing you in...",
  loggingOut: "Logging out...",
};

// Full screen while signing in finishes (after the Apple/Google sheet
// closes) or while logging out: the screen underneath can't be tapped and
// it's clear something is happening. A Modal so it also covers bottom sheets
// (e.g. the login gate). Mounted once in app/_layout.tsx.
export function AuthActivityOverlay() {
  const activity = useAuthActivityStore((s) => s.activity);
  const [settling, setSettling] = useState(false);
  // Keeps the label through the fade-out, after activity has gone null.
  const [label, setLabel] = useState(LABELS.signingIn);

  // Always hold a beat after the activity ends: the session can reach the
  // app's store a moment after the call returns, so its state can't tell us
  // the new screen is ready. (A cancelled sign-in never shows this at all.)
  useEffect(() => {
    if (activity) {
      setLabel(LABELS[activity]);
      setSettling(true);
      return;
    }
    const timer = setTimeout(() => setSettling(false), SETTLE_MS);
    return () => clearTimeout(timer);
  }, [activity]);

  return (
    <Modal visible={!!activity || settling} transparent animationType="fade" statusBarTranslucent>
      <View className="flex-1 items-center justify-center gap-5 bg-white" accessibilityLiveRegion="polite">
        <Spinner variant="spiral" size={SPIRAL_SIZE} color={colors.accent} />
        <AppText variant="caption">{label}</AppText>
      </View>
    </Modal>
  );
}
