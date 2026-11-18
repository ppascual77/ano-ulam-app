import { useState } from "react";
import { Pressable, View } from "react-native";
import * as Haptics from "expo-haptics";
import { Bell, BellOff, BellRing, Lock } from "lucide-react-native";
import { showGlobalToast } from "@/frontend/components/ui";
import { colors } from "@/frontend/constants/theme";
import { ProFeatureSheet } from "@/frontend/core/pro/components/ProFeatureSheet";
import { useIsPro } from "@/frontend/core/pro/store/useProStore";
import { canReceivePush } from "@/frontend/core/notifications/push";
import { usePushPermission } from "@/frontend/core/notifications/hooks/usePushPermission";
import { useAccountSettings, useAccountSettingsActions } from "@/frontend/features/profile/hooks/useProfile";
import { useAuth } from "@/frontend/features/auth/hooks/useAuth";

// Beside "This week's fresh picks": price drop alerts at a tap.
// - Free (and guests): a bell with a small lock; it opens the price alerts
//   feature sheet (the same reel as Settings > Pro features).
// - Pro: on (a ringing bell, green) or off (a crossed-out bell); a tap turns
//   the alerts on or off, same as Settings. Pushes switched off for the app
//   entirely: it says where to turn them on instead.
export function PriceAlertBell() {
  const isPro = useIsPro();
  const { isSignedIn } = useAuth();
  const settings = useAccountSettings();
  const actions = useAccountSettingsActions();
  const push = usePushPermission();
  const [sheetOpen, setSheetOpen] = useState(false);
  const pushOn = isSignedIn && (settings.data?.push_enabled ?? true) && canReceivePush(push.permission);
  const alertsOn = isPro && pushOn && (settings.data?.push_price_alerts ?? true);

  const press = () => {
    void Haptics.selectionAsync();
    if (!isPro) return setSheetOpen(true);
    if (!pushOn) {
      return showGlobalToast({ tone: "error", message: "Notifications are off. Turn them on in Settings to get price alerts." });
    }
    const next = !alertsOn;
    actions.setPriceAlerts(next);
    showGlobalToast({ tone: "success", message: next ? "Price drop alerts on" : "Price drop alerts off" });
  };

  return (
    <>
      <Pressable
        onPress={press}
        hitSlop={10}
        accessibilityRole={isPro ? "switch" : "button"}
        accessibilityState={isPro ? { checked: alertsOn } : undefined}
        accessibilityLabel={isPro ? "Price drop alerts" : "Price drop alerts, a Pro feature"}
        className={`h-9 w-9 items-center justify-center rounded-full ${alertsOn ? "bg-primary/10" : "bg-ink-emphasis/5"}`}
      >
        {!isPro ? (
          <Bell color={colors.ink.emphasis} size={18} />
        ) : alertsOn ? (
          <BellRing color={colors.primary} size={18} />
        ) : (
          <BellOff color={colors.ink.subtle} size={18} />
        )}
        {!isPro && (
          <View className="absolute -right-0.5 -top-0.5 h-4 w-4 items-center justify-center rounded-full bg-accent">
            <Lock color={colors.white} size={9} strokeWidth={2.75} />
          </View>
        )}
      </Pressable>
      <ProFeatureSheet feature={sheetOpen ? "alerts" : null} onClose={() => setSheetOpen(false)} />
    </>
  );
}
